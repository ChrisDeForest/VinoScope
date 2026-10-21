from PIL import Image

from scripts.make_favicons import write_favicons


def test_writes_the_three_icons(tmp_path):
    paths = write_favicons(tmp_path)
    assert sorted(p.name for p in paths) == ["apple-touch-icon.png", "favicon.ico", "favicon.svg"]


def test_svg_draws_the_v_as_a_shape_not_text(tmp_path):
    write_favicons(tmp_path)
    svg = (tmp_path / "favicon.svg").read_text(encoding="utf-8")
    assert svg.startswith("<svg")
    assert "<text" not in svg
    assert "<polygon" in svg
    assert "#c9a86a" in svg and "#231416" in svg


def test_raster_sizes(tmp_path):
    write_favicons(tmp_path)
    assert Image.open(tmp_path / "apple-touch-icon.png").size == (180, 180)
    ico = Image.open(tmp_path / "favicon.ico")
    assert set(ico.info["sizes"]) == {(16, 16), (32, 32), (48, 48)}
