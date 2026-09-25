import pytest
from PIL import Image
import pandas as pd

from scripts.process_wine_images import (
    CANVAS_SIZE,
    MANIFEST_COLUMNS,
    build_manifest,
    fill_interior_holes,
    fit_on_canvas,
    has_bom,
    process_image,
    read_wines_csv,
    set_image_urls,
    slugify,
    wine_slug,
    write_wines_csv,
)


def _wines(rows):
    return pd.DataFrame(rows, columns=["name", "winery", "vintage", "type", "image_url"])


def test_slugify_strips_accents_and_punctuation():
    assert slugify("Château d'Yquem") == "chateau-d-yquem"
    assert slugify("[yellow tail]  Shiraz!") == "yellow-tail-shiraz"
    assert slugify("Dönnhoff Riesling Spätlese") == "donnhoff-riesling-spatlese"


def test_wine_slug_uses_nv_for_blank_or_nv_vintage():
    assert wine_slug("Caymus Vineyards", "Caymus Napa Valley Cabernet Sauvignon", "2023") == (
        "caymus-vineyards-caymus-napa-valley-cabernet-sauvignon-2023"
    )
    assert wine_slug("Graham's", "Six Grapes Reserve Port", "") == "graham-s-six-grapes-reserve-port-nv"
    assert wine_slug("Graham's", "Six Grapes Reserve Port", "NV") == "graham-s-six-grapes-reserve-port-nv"


def test_build_manifest_has_one_row_per_wine_with_blank_source():
    wines = _wines([["Artemis", "Stag's Leap", "2021", "red", ""], ["Six Grapes", "Graham's", "", "fortified", ""]])
    manifest = build_manifest(wines)
    assert list(manifest.columns) == MANIFEST_COLUMNS
    assert list(manifest["slug"]) == ["stag-s-leap-artemis-2021", "graham-s-six-grapes-nv"]
    assert list(manifest["source"]) == ["", ""]


def test_build_manifest_keeps_existing_research():
    wines = _wines([["Artemis", "Stag's Leap", "2021", "red", ""]])
    existing = pd.DataFrame(
        [["stag-s-leap-artemis-2021", "Stag's Leap", "Artemis", "2021", "red", "real", "https://x/y.png", "front label"]],
        columns=MANIFEST_COLUMNS,
    )
    manifest = build_manifest(wines, existing)
    row = manifest.iloc[0]
    assert (row["source"], row["source_url"], row["notes"]) == ("real", "https://x/y.png", "front label")


def test_set_image_urls_only_touches_matching_rows():
    wines = _wines([["Artemis", "Stag's Leap", "2021", "red", ""], ["Six Grapes", "Graham's", "NV", "fortified", ""]])
    updated = set_image_urls(wines, {"graham-s-six-grapes-nv": "/wines/graham-s-six-grapes-nv.webp"})
    assert list(updated["image_url"]) == ["", "/wines/graham-s-six-grapes-nv.webp"]
    assert list(wines["image_url"]) == ["", ""]


def test_csv_round_trip_preserves_bom_state_and_blanks(tmp_path):
    bom_path = tmp_path / "raw.csv"
    bom_path.write_bytes("﻿name,winery,vintage,type,image_url\nSix Grapes,Graham's,NV,fortified,\n".encode("utf-8"))
    plain_path = tmp_path / "cleaned.csv"
    plain_path.write_text("name,winery,vintage,type,image_url\nSix Grapes,Graham's,,fortified,\n", encoding="utf-8")

    for path in (bom_path, plain_path):
        bom = has_bom(path)
        df = read_wines_csv(path)
        assert list(df.columns)[0] == "name"
        assert df.loc[0, "image_url"] == ""
        write_wines_csv(df, path, bom)
        assert has_bom(path) is bom

    assert has_bom(bom_path) is True
    assert has_bom(plain_path) is False
    assert read_wines_csv(plain_path).loc[0, "vintage"] == ""


def _bottle_on_transparent():
    image = Image.new("RGBA", (100, 300), (0, 0, 0, 0))
    image.paste((150, 20, 40, 255), (25, 50, 75, 250))  # 50x200 opaque "bottle"
    return image


def _white_to_transparent(image):
    rgba = image.convert("RGBA")
    rgba.putdata([(r, g, b, 0) if (r, g, b) == (255, 255, 255) else (r, g, b, a) for r, g, b, a in rgba.getdata()])
    return rgba


def test_fit_on_canvas_centres_and_scales_bottle_to_height_limit():
    result = fit_on_canvas(_bottle_on_transparent())
    assert result.size == CANVAS_SIZE == (600, 900)
    assert result.mode == "RGBA"
    # scale = min(540/50, 860/200) = 4.3 -> 215x860, centred
    assert result.getchannel("A").getbbox() == (192, 20, 407, 880)
    assert result.getpixel((0, 0))[3] == 0
    assert result.getpixel((300, 450))[3] == 255


def test_fit_on_canvas_rejects_fully_transparent_image():
    with pytest.raises(ValueError, match="transparent"):
        fit_on_canvas(Image.new("RGBA", (10, 10), (0, 0, 0, 0)))


def test_fit_on_canvas_ignores_faint_noise_pixel_when_centring():
    # rembg can leave a single near-zero-alpha noise pixel at the image edge;
    # it must not stretch the bbox and off-centre the real bottle.
    image = _bottle_on_transparent()
    image.putpixel((0, 0), (10, 10, 10, 5))
    result = fit_on_canvas(image)
    assert result.getchannel("A").getbbox() == (192, 20, 407, 880)


def _ring_and_notch():
    # A closed square ring with a fully-enclosed transparent hole, and a
    # separate "U"-shaped bracket whose open side connects its interior
    # pocket straight to the image border (not enclosed).
    image = Image.new("RGBA", (140, 60), (0, 0, 0, 0))
    color = (150, 20, 40, 255)
    image.paste(color, (10, 10, 40, 40))  # opaque 30x30 frame
    image.paste((245, 245, 230, 0), (16, 16, 34, 34))  # fully enclosed transparent hole
    image.paste(color, (70, 5, 100, 10))  # bracket top bar
    image.paste(color, (70, 5, 75, 60))  # bracket left bar, open bottom
    image.paste(color, (95, 5, 100, 60))  # bracket right bar, open bottom
    return image


def test_fill_interior_holes_fills_fully_enclosed_transparent_region():
    filled = fill_interior_holes(_ring_and_notch())
    assert filled.getpixel((25, 25)) == (245, 245, 230, 255)


def test_fill_interior_holes_leaves_notch_open_to_the_border_transparent():
    filled = fill_interior_holes(_ring_and_notch())
    assert filled.getpixel((85, 30))[3] == 0


def test_process_image_writes_transparent_webp(tmp_path):
    raw = tmp_path / "bottle.jpg"
    source = Image.new("RGB", (200, 400), (255, 255, 255))
    source.paste((90, 10, 30), (70, 40, 130, 360))
    source.save(raw, "PNG")  # PNG content keeps pure white exact for the stub remover
    out = tmp_path / "out" / "bottle.webp"

    process_image(raw, out, _white_to_transparent)

    with Image.open(out) as written:
        assert written.format == "WEBP"
        assert written.size == (600, 900)
        assert written.mode == "RGBA"
        assert written.getpixel((5, 5))[3] == 0
        assert written.getpixel((300, 450))[3] == 255
