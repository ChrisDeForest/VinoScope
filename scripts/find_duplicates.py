import sys

import pandas as pd
from rapidfuzz import fuzz

NAME_THRESHOLD = 90
WINERY_THRESHOLD = 90


def score_pair(row_a, row_b):
    name_score = fuzz.token_set_ratio(str(row_a["name"]), str(row_b["name"]))
    winery_score = fuzz.token_set_ratio(str(row_a["winery"]), str(row_b["winery"]))
    return name_score, winery_score


def is_likely_duplicate(row_a, row_b):
    if str(row_a.get("vintage")) != str(row_b.get("vintage")):
        return False
    name_score, winery_score = score_pair(row_a, row_b)
    return name_score >= NAME_THRESHOLD and winery_score >= WINERY_THRESHOLD


def find_duplicate_pairs(df):
    pairs = []
    for i in range(len(df)):
        for j in range(i + 1, len(df)):
            row_a, row_b = df.iloc[i], df.iloc[j]
            if is_likely_duplicate(row_a, row_b):
                name_score, winery_score = score_pair(row_a, row_b)
                pairs.append(
                    {
                        "index_a": i,
                        "index_b": j,
                        "name_a": row_a["name"],
                        "name_b": row_b["name"],
                        "winery_a": row_a["winery"],
                        "winery_b": row_b["winery"],
                        "vintage": row_a.get("vintage"),
                        "name_score": name_score,
                        "winery_score": winery_score,
                    }
                )
    return pairs


def write_review_file(cleaned_csv_path, review_csv_path):
    df = pd.read_csv(cleaned_csv_path, dtype=str)
    pairs = find_duplicate_pairs(df)
    pd.DataFrame(pairs).to_csv(review_csv_path, index=False)
    return len(pairs)


if __name__ == "__main__":
    count = write_review_file(sys.argv[1], sys.argv[2])
    print(f"Found {count} potential duplicate pair(s). Review: {sys.argv[2]}")
