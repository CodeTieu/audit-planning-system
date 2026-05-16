"""Temporary script to extract regional contacts from Excel."""
import pandas as pd
import json
import sys

xlsx_path = r"C:/Users/kanza/WP Automation/NAOT_Contacts_Cleaned (1).xlsx"

xl = pd.ExcelFile(xlsx_path)
print("All sheets:", xl.sheet_names)

for sheet in xl.sheet_names:
    df = pd.read_excel(xlsx_path, sheet_name=sheet)
    print(f"\n=== Sheet: {sheet} ===")
    print("Columns:", list(df.columns))
    print("Rows:", len(df))
    print(df.to_string())
