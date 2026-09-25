import numpy as np
import pytest
from PIL import Image
import pandas as pd

from scripts.process_wine_images import (
    CANVAS_SIZE,
    DEFAULT_MODEL,
    MANIFEST_COLUMNS,
    build_manifest,
    fill_interior_holes,
    fit_on_canvas,
    has_bom,
    has_transparent_background,
    keep_largest_component,
    main,
    parse_process_options,
    process_all,
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
        [
            [
                "stag-s-leap-artemis-2021",
                "Stag's Leap",
                "Artemis",
                "2021",
                "red",
                "real",
                "https://x/y.png",
                "front label",
                "flatten model=birefnet-general",
            ]
        ],
        columns=MANIFEST_COLUMNS,
    )
    manifest = build_manifest(wines, existing)
    row = manifest.iloc[0]
    assert (row["source"], row["source_url"], row["notes"]) == ("real", "https://x/y.png", "front label")
    assert row["process_options"] == "flatten model=birefnet-general"


def test_build_manifest_raises_a_clear_error_on_duplicate_slug_in_existing():
    wines = _wines([["Artemis", "Stag's Leap", "2021", "red", ""]])
    existing = pd.DataFrame(
        [
            ["stag-s-leap-artemis-2021", "Stag's Leap", "Artemis", "2021", "red", "real", "https://x/y.png", "", ""],
            ["stag-s-leap-artemis-2021", "Stag's Leap", "Artemis", "2021", "red", "real", "https://x/z.png", "", ""],
        ],
        columns=MANIFEST_COLUMNS,
    )
    with pytest.raises(ValueError, match="duplicate slug.*stag-s-leap-artemis-2021"):
        build_manifest(wines, existing)


def test_build_manifest_prints_slugs_dropped_from_the_wines_csv(capsys):
    wines = _wines([["Artemis", "Stag's Leap", "2021", "red", ""]])
    existing = pd.DataFrame(
        [
            ["stag-s-leap-artemis-2021", "Stag's Leap", "Artemis", "2021", "red", "real", "https://x/y.png", "", ""],
            ["old-winery-old-wine-2019", "Old Winery", "Old Wine", "2019", "red", "real", "https://x/old.png", "", ""],
        ],
        columns=MANIFEST_COLUMNS,
    )
    build_manifest(wines, existing)
    assert "old-winery-old-wine-2019" in capsys.readouterr().out


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


def _fail_remover(image):
    raise AssertionError("remover must not run on an already-transparent source")


def test_process_image_keeps_existing_transparency_without_remover(tmp_path):
    # Producer packshots often ship as transparent PNGs; running rembg on
    # them punches holes in dark or clear glass, so their own alpha wins.
    raw = tmp_path / "bottle.png"
    source = Image.new("RGBA", (200, 400), (255, 255, 255, 0))
    source.paste((40, 10, 20, 255), (70, 40, 130, 360))
    source.save(raw, "PNG")
    out = tmp_path / "bottle.webp"

    process_image(raw, out, _fail_remover)

    with Image.open(out) as written:
        assert written.getpixel((5, 5))[3] == 0
        assert written.getpixel((300, 450))[3] == 255


def test_has_transparent_background_needs_fully_transparent_pixels():
    clear = Image.new("RGBA", (50, 50), (0, 0, 0, 0))
    clear.paste((200, 0, 0, 255), (10, 10, 40, 40))
    assert has_transparent_background(clear)
    assert not has_transparent_background(Image.new("RGBA", (50, 50), (255, 255, 255, 255)))
    assert not has_transparent_background(Image.new("RGB", (50, 50), (255, 255, 255)))


def test_process_image_flatten_sends_transparent_source_to_remover_on_white(tmp_path):
    raw = tmp_path / "bottle.png"
    source = Image.new("RGBA", (200, 400), (0, 0, 0, 0))
    source.paste((40, 10, 20, 255), (70, 40, 130, 360))
    source.save(raw, "PNG")
    seen = []

    def remover(image):
        seen.append(image.convert("RGB").getpixel((5, 5)))
        return _white_to_transparent(image)

    process_image(raw, tmp_path / "bottle.webp", remover, flatten=True)

    assert seen == [(255, 255, 255)]


def test_process_image_leaves_holes_in_an_already_transparent_source(tmp_path):
    raw = tmp_path / "ring.png"
    _ring_and_notch().save(raw, "PNG")
    out = tmp_path / "ring.webp"

    process_image(raw, out, _fail_remover)

    with Image.open(out) as written:
        # Content bbox (10, 5, 100, 60) is scaled x6 to 540x330 and offset
        # to (30, 285), so the hole centre (25, 25) lands at (120, 405).
        assert written.getpixel((120, 405))[3] == 0


# ---------------------------------------------------------------------------
# Item 3: per-slug process_options (flatten, model, largest-component, crop, locked)
# ---------------------------------------------------------------------------


def test_parse_process_options_parses_every_token():
    options = parse_process_options("flatten model=birefnet-general largest-component crop=10,20,300,400 locked")
    assert options == {
        "flatten": True,
        "model": "birefnet-general",
        "largest_component": True,
        "crop": (10, 20, 300, 400),
        "locked": True,
    }


def test_parse_process_options_blank_is_all_defaults():
    for blank in ("", None):
        assert parse_process_options(blank) == {
            "flatten": False,
            "model": None,
            "largest_component": False,
            "crop": None,
            "locked": False,
        }


def test_parse_process_options_rejects_an_unknown_token():
    with pytest.raises(ValueError, match="unknown process_options token"):
        parse_process_options("glitter")


def test_parse_process_options_rejects_a_malformed_crop():
    with pytest.raises(ValueError, match="crop"):
        parse_process_options("crop=1,2,3")


def _two_blobs():
    # A big 30x30 blob and a small, detached 10x10 blob of debris.
    image = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
    image.paste((150, 20, 40, 255), (10, 10, 40, 40))
    image.paste((10, 10, 10, 255), (70, 70, 80, 80))
    return image


def test_keep_largest_component_drops_detached_debris():
    result = keep_largest_component(_two_blobs())
    arr = np.array(result)
    assert arr[25, 25, 3] == 255  # inside the big blob
    assert arr[75, 75, 3] == 0  # the small stray blob is gone


def test_keep_largest_component_leaves_a_single_component_untouched():
    solo = Image.new("RGBA", (40, 40), (0, 0, 0, 0))
    solo.paste((10, 20, 30, 255), (5, 5, 35, 35))
    result = keep_largest_component(solo)
    assert np.array(result)[..., 3].sum() == np.array(solo.convert("RGBA"))[..., 3].sum()


def test_process_image_applies_the_largest_component_option(tmp_path):
    raw = tmp_path / "debris.png"
    _two_blobs().save(raw, "PNG")
    out = tmp_path / "debris.webp"

    process_image(raw, out, _fail_remover, largest_component=True)

    with Image.open(out) as written:
        arr = np.array(written)
        # Only one connected opaque region should remain on the canvas.
        from scipy.ndimage import label

        _, count = label(arr[..., 3] > 0, structure=np.ones((3, 3), dtype=int))
        assert count == 1


def test_process_image_applies_a_raw_pixel_crop_before_cutout(tmp_path):
    raw = tmp_path / "bottle_with_reflection.png"
    source = Image.new("RGBA", (200, 400), (0, 0, 0, 0))
    source.paste((40, 10, 20, 255), (70, 40, 130, 300))  # the bottle
    source.paste((40, 10, 20, 255), (70, 300, 130, 340))  # a reflection touching its base
    source.save(raw, "PNG")
    out_full = tmp_path / "full.webp"
    out_cropped = tmp_path / "cropped.webp"

    process_image(raw, out_full, _fail_remover)
    process_image(raw, out_cropped, _fail_remover, crop=(0, 0, 200, 300))

    with Image.open(out_full) as full, Image.open(out_cropped) as cropped:
        # Uncropped: bottle (60x260) + reflection (60x40) = 60x300 content,
        # height-limited scale 860/300 -> 172x860, centred.
        assert full.getchannel("A").getbbox() == (214, 20, 386, 880)
        # Cropped: the reflection (y >= 300) is gone before cutout, so only
        # the 60x260 bottle remains -- a taller aspect ratio, scaled more
        # (860/260) to a wider 198x860 box, though still centred at the same
        # vertical position.
        assert cropped.getchannel("A").getbbox() == (201, 20, 399, 880)


# ---------------------------------------------------------------------------
# Item 5: batch robustness -- one bad slug or a missing CSV must not abort the rest
# ---------------------------------------------------------------------------


def _write_manifest(path, rows):
    write_wines_csv(pd.DataFrame(rows, columns=MANIFEST_COLUMNS), path, bom=False)


def _patch_pipeline_paths(monkeypatch, tmp_path):
    import scripts.process_wine_images as pwi

    manifest_path = tmp_path / "manifest.csv"
    raw_dir = tmp_path / "raw"
    out_dir = tmp_path / "out"
    raw_csv = tmp_path / "raw.csv"
    cleaned_csv = tmp_path / "cleaned.csv"
    raw_dir.mkdir()
    out_dir.mkdir()
    monkeypatch.setattr(pwi, "MANIFEST_PATH", manifest_path)
    monkeypatch.setattr(pwi, "RAW_DIR", raw_dir)
    monkeypatch.setattr(pwi, "OUT_DIR", out_dir)
    monkeypatch.setattr(pwi, "RAW_CSV", raw_csv)
    monkeypatch.setattr(pwi, "CLEANED_CSV", cleaned_csv)
    return pwi, manifest_path, raw_dir, out_dir, raw_csv, cleaned_csv


def _identity_remover(model=DEFAULT_MODEL):
    return lambda image: image


def test_process_all_continues_past_a_failed_slug_and_still_updates_the_csvs(tmp_path, monkeypatch, capsys):
    pwi, manifest_path, raw_dir, out_dir, raw_csv, cleaned_csv = _patch_pipeline_paths(monkeypatch, tmp_path)
    monkeypatch.setattr(pwi, "rembg_remover", _identity_remover)

    good_slug = pwi.wine_slug("Zzz Winery", "Good Wine", "2021")
    bad_slug = pwi.wine_slug("Zzz Winery", "Bad Wine", "2021")
    _write_manifest(
        manifest_path,
        [
            [good_slug, "Zzz Winery", "Good Wine", "2021", "red", "real", "", "", ""],
            [bad_slug, "Zzz Winery", "Bad Wine", "2021", "red", "real", "", "", ""],
        ],
    )
    # bad_slug's raw is fully transparent, so fit_on_canvas raises inside process_image.
    Image.new("RGBA", (50, 50), (0, 0, 0, 0)).save(raw_dir / f"{bad_slug}.png")
    good = Image.new("RGBA", (50, 50), (0, 0, 0, 0))
    good.paste((10, 10, 10, 255), (5, 5, 40, 40))
    good.save(raw_dir / f"{good_slug}.png")

    wines = pd.DataFrame(
        [["Good Wine", "Zzz Winery", "2021", "red", ""], ["Bad Wine", "Zzz Winery", "2021", "red", ""]],
        columns=["name", "winery", "vintage", "type", "image_url"],
    )
    wines.to_csv(raw_csv, index=False)
    wines.to_csv(cleaned_csv, index=False)

    pwi.process_all()

    assert (out_dir / f"{good_slug}.webp").exists()
    assert not (out_dir / f"{bad_slug}.webp").exists()
    out = capsys.readouterr().out
    assert bad_slug in out
    updated = read_wines_csv(cleaned_csv)
    assert updated.loc[updated["name"] == "Good Wine", "image_url"].iloc[0] == f"/wines/{good_slug}.webp"
    assert updated.loc[updated["name"] == "Bad Wine", "image_url"].iloc[0] == ""


def test_process_all_skips_csvs_that_dont_exist_yet(tmp_path, monkeypatch, capsys):
    pwi, manifest_path, raw_dir, out_dir, raw_csv, cleaned_csv = _patch_pipeline_paths(monkeypatch, tmp_path)
    monkeypatch.setattr(pwi, "rembg_remover", _identity_remover)
    _write_manifest(manifest_path, [])

    pwi.process_all()  # must not raise FileNotFoundError even though the CSVs are absent

    out = capsys.readouterr().out
    assert "not found" in out.lower() or "skip" in out.lower()


def test_process_all_skips_a_locked_slug_even_with_force(tmp_path, monkeypatch, capsys):
    pwi, manifest_path, raw_dir, out_dir, raw_csv, cleaned_csv = _patch_pipeline_paths(monkeypatch, tmp_path)
    monkeypatch.setattr(pwi, "rembg_remover", _identity_remover)

    slug = pwi.wine_slug("Zzz Winery", "Locked Wine", "2021")
    _write_manifest(manifest_path, [[slug, "Zzz Winery", "Locked Wine", "2021", "red", "real", "", "", "locked"]])
    (out_dir / f"{slug}.webp").write_bytes(b"hand-tuned bytes")
    # No raw source at all: a locked slug must be skipped before a raw file is even looked for.

    pwi.process_all(force=True)

    assert (out_dir / f"{slug}.webp").read_bytes() == b"hand-tuned bytes"
    out = capsys.readouterr().out
    assert "locked" in out.lower()
    assert slug in out


# ---------------------------------------------------------------------------
# Item 6: --flatten/--model only apply with --only
# ---------------------------------------------------------------------------


def test_main_rejects_global_flatten_without_only(capsys):
    with pytest.raises(SystemExit):
        main(["process", "--flatten"])
    assert "--only" in capsys.readouterr().err


def test_main_rejects_global_model_without_only(capsys):
    with pytest.raises(SystemExit):
        main(["process", "--model", "birefnet-general"])
    assert "--only" in capsys.readouterr().err


def test_main_allows_flatten_and_model_when_only_is_given(monkeypatch):
    called = {}
    monkeypatch.setattr("scripts.process_wine_images.process_all", lambda **kwargs: called.update(kwargs))
    main(["process", "--only", "some-slug", "--flatten", "--model", "birefnet-general", "--force"])
    assert called == {"only": "some-slug", "force": True, "model": "birefnet-general", "flatten": True}
