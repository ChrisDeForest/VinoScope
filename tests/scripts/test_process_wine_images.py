import pandas as pd

from scripts.process_wine_images import (
    MANIFEST_COLUMNS,
    build_manifest,
    has_bom,
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
