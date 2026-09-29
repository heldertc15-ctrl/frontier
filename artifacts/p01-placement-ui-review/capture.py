"""Capture and exercise the isolated P01 placement fixture at acceptance sizes.

Run with FRONTIER_REVIEW_PASSWORD set for the local room-review account and
the isolated development server on http://localhost:3004.
"""

import json
import os
import re
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from playwright.sync_api import sync_playwright


BASE = "http://localhost:3004"
OUTPUT = Path("artifacts/p01-placement-ui-review")
SIZES = [(1366, 768), (1440, 900), (1920, 1080), (320, 640), (390, 640)]


def login_cookie():
    password = os.environ.get("FRONTIER_REVIEW_PASSWORD")
    if not password:
        raise RuntimeError("Set FRONTIER_REVIEW_PASSWORD for the local review account.")
    def post(path, body):
        request = Request(
            f"{BASE}{path}",
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(request) as response:
            return response.headers["Set-Cookie"]

    try:
        header = post("/api/auth/login", {"username": "room-review", "password": password})
    except HTTPError as error:
        if error.code != 401:
            raise
        header = post(
            "/api/auth/register",
            {"username": "room-review", "password": password, "characterName": "Room Review"},
        )
    session = re.search(r"frontier_session=([^;]+)", header)
    if not session:
        raise RuntimeError("The review session cookie was missing.")
    return session.group(1)


def main():
    OUTPUT.mkdir(exist_ok=True)
    session = login_cookie()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            channel="chrome", headless=True, args=["--disable-gpu-sandbox"]
        )
        context = browser.new_context(viewport={"width": 1366, "height": 768})
        context.add_cookies(
            [{"name": "frontier_session", "value": session, "url": BASE, "httpOnly": True}]
        )
        page = context.new_page()
        page.goto(BASE)
        page.get_by_role("button", name="Open development test room").click()
        page.locator(".room-canvas canvas").wait_for()
        page.get_by_role("button", name=re.compile("Test bench")).click()
        for _ in range(3):
            page.get_by_role("button", name="Move preview southeast").click()
        for _ in range(2):
            page.get_by_role("button", name="Move preview southwest").click()
        page.get_by_role("button", name=re.compile("Rotate 90°")).click()
        assert "Cell 3, 2" in page.locator(".room-draft-metrics").inner_text()
        assert "1 × 2 tiles" in page.locator(".room-footprint-size").inner_text()

        for width, height in SIZES:
            page.set_viewport_size({"width": width, "height": height})
            if width <= 760:
                page.locator(".world-stage").scroll_into_view_if_needed()
            else:
                page.evaluate("window.scrollTo(0, 0)")
            page.evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
            metric = page.evaluate(
                """() => ({
                    width: innerWidth,
                    height: innerHeight,
                    scrollWidth: document.documentElement.scrollWidth,
                    scrollHeight: document.documentElement.scrollHeight,
                    canvasWidth: document.querySelector('.room-canvas').getBoundingClientRect().width,
                    contextWidth: document.querySelector('.room-context').getBoundingClientRect().width,
                    contextScrollHeight: document.querySelector('.room-context .location-body').scrollHeight,
                    contextClientHeight: document.querySelector('.room-context .location-body').clientHeight
                })"""
            )
            assert (metric["width"], metric["height"]) == (width, height)
            assert metric["scrollWidth"] <= width
            if width > 760:
                assert metric["scrollHeight"] <= height
                assert metric["canvasWidth"] > (width - 176) / 2
            file = OUTPUT / f"room-preview-{width}x{height}.png"
            page.screenshot(path=str(file))
            print(json.dumps({"capture": str(file), "metric": metric}))
            page.locator(".hud-pack-button").click()
            drawer = page.locator(".inventory-drawer")
            drawer.wait_for(state="visible")
            box = drawer.bounding_box()
            assert box and box["x"] >= 0 and box["x"] + box["width"] <= width
            assert box["y"] >= 0 and box["y"] + box["height"] <= height
            assert page.evaluate("document.documentElement.scrollWidth") <= width
            if width in (1366, 320):
                page.screenshot(path=str(OUTPUT / f"room-drawer-{width}x{height}.png"))
            page.get_by_role("button", name="Close inventory").click()
            assert "Cell 3, 2" in page.locator(".room-draft-metrics").inner_text()
            print(json.dumps({"drawer_checked": f"{width}x{height}", "box": box}))

        # Touch positions the ghost. The explicit action sends the command.
        touch = browser.new_context(
            viewport={"width": 390, "height": 640}, has_touch=True, is_mobile=True
        )
        touch.add_cookies(
            [{"name": "frontier_session", "value": session, "url": BASE, "httpOnly": True}]
        )
        mobile = touch.new_page()
        mobile.goto(BASE)
        mobile.get_by_role("button", name="Open development test room").click()
        mobile.locator(".room-canvas canvas").wait_for()
        mobile.get_by_role("button", name=re.compile("Test bench")).click()
        before = mobile.locator(".room-draft-metrics").inner_text()
        mobile.locator(".room-canvas canvas").tap(position={"x": 217, "y": 143})
        after = mobile.locator(".room-draft-metrics").inner_text()
        mobile.screenshot(path=str(OUTPUT / "room-touch-preview-390x640.png"))
        assert before != after and "Cell 3, 2" in after
        assert mobile.get_by_role("button", name="Place at tile").is_enabled()
        print(json.dumps({"touch_preview": after, "explicit_place_available": True}))
        touch.close()

        page.set_viewport_size({"width": 1366, "height": 768})
        page.get_by_role("button", name="Place furniture").click()
        page.get_by_text("Furniture saved.").wait_for()
        page.reload()
        page.get_by_role("button", name="Open development test room").click()
        page.get_by_role("button", name=re.compile("Test bench")).click()
        page.get_by_role("button", name="Move selected furniture").click()
        page.get_by_role("button", name="Move preview southeast").click()
        page.get_by_role("button", name="Save move").click()
        page.get_by_text("Furniture saved.").wait_for()
        assert "Cell 4, 2" in page.locator(".room-selected").inner_text()
        page.screenshot(path=str(OUTPUT / "room-saved-move-1366x768.png"))
        print(json.dumps({"saved_move": "Cell 4, 2"}))
        page.get_by_role("button", name=re.compile("Test chair")).click()
        for _ in range(4):
            page.get_by_role("button", name="Move preview southeast").click()
        for _ in range(2):
            page.get_by_role("button", name="Move preview southwest").click()
        assert "Another piece occupies this space." in page.locator(".room-invalid").first.inner_text()
        assert page.get_by_role("button", name="Place furniture").is_disabled()
        page.screenshot(path=str(OUTPUT / "room-invalid-1366x768.png"))
        print(json.dumps({"invalid_preview": "overlap blocked"}))
        page.get_by_role("button", name="Move preview northwest").click()
        assert page.get_by_role("button", name="Place furniture").is_enabled()
        page.route("**/api/rooms/**/place", lambda route: route.abort())
        page.get_by_role("button", name="Place furniture").click()
        page.get_by_text("Save needs reconciliation").wait_for()
        assert page.get_by_role("button", name="Retry same action").is_enabled()
        page.screenshot(path=str(OUTPUT / "room-connection-error-1366x768.png"))
        page.unroute("**/api/rooms/**/place")
        page.get_by_role("button", name="Retry same action").click()
        page.get_by_text("Furniture saved.").wait_for()
        print(json.dumps({"connection_recovery": "same command retried"}))
        browser.close()


if __name__ == "__main__":
    main()
