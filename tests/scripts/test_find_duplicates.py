import pandas as pd

from scripts.find_duplicates import find_duplicate_pairs, is_likely_duplicate, write_review_file


def test_is_likely_duplicate_flags_close_name_and_winery_same_vintage():
    row_a = pd.Series({"name": "Caymus Cabernet Sauvignon", "winery": "Caymus Vineyards", "vintage": "2022"})
    row_b = pd.Series({"name": "Caymus Vineyards Cabernet Sauvignon", "winery": "Caymus Vineyards", "vintage": "2022"})
    assert is_likely_duplicate(row_a, row_b) is True


def test_is_likely_duplicate_rejects_different_vintage():
    row_a = pd.Series({"name": "Caymus Cabernet Sauvignon", "winery": "Caymus Vineyards", "vintage": "2022"})
    row_b = pd.Series({"name": "Caymus Cabernet Sauvignon", "winery": "Caymus Vineyards", "vintage": "2021"})
    assert is_likely_duplicate(row_a, row_b) is False


def test_is_likely_duplicate_rejects_unrelated_wines():
    row_a = pd.Series({"name": "Caymus Cabernet Sauvignon", "winery": "Caymus Vineyards", "vintage": "2022"})
    row_b = pd.Series({"name": "Kendall-Jackson Chardonnay", "winery": "Kendall-Jackson", "vintage": "2022"})
    assert is_likely_duplicate(row_a, row_b) is False


def test_find_duplicate_pairs_returns_one_pair_for_three_rows_with_one_duplicate():
    df = pd.DataFrame(
        [
            {"name": "Caymus Cabernet Sauvignon", "winery": "Caymus Vineyards", "vintage": "2022"},
            {"name": "Caymus Vineyards Cabernet Sauvignon", "winery": "Caymus Vineyards", "vintage": "2022"},
            {"name": "Kendall-Jackson Chardonnay", "winery": "Kendall-Jackson", "vintage": "2022"},
        ]
    )
    pairs = find_duplicate_pairs(df)
    assert len(pairs) == 1
    assert pairs[0]["index_a"] == 0
    assert pairs[0]["index_b"] == 1


def test_write_review_file_writes_csv_with_pair_count(tmp_path):
    cleaned_csv = tmp_path / "cleaned.csv"
    cleaned_csv.write_text(
        "name,winery,vintage\n"
        "Caymus Cabernet Sauvignon,Caymus Vineyards,2022\n"
        "Caymus Vineyards Cabernet Sauvignon,Caymus Vineyards,2022\n"
    )
    review_csv = tmp_path / "review.csv"

    count = write_review_file(str(cleaned_csv), str(review_csv))

    assert count == 1
    review_df = pd.read_csv(review_csv)
    assert len(review_df) == 1
