#!/usr/bin/env python3
"""
Create a 10k row sample of the HI-Small_Trans.csv file
"""
import pandas as pd
import os

# Path to the large CSV
input_file = os.path.join(os.path.dirname(__file__), 'data', 'HI-Small_Trans.csv')
output_file = os.path.join(os.path.dirname(__file__), 'data', 'HI-Small_Trans_10k.csv')

print(f"Reading CSV file: {input_file}")
print("This may take a moment due to file size...")

# Read only first 10,001 rows (header + 10k data rows)
df = pd.read_csv(input_file, nrows=10000)

print(f"✓ Read {len(df)} rows")
print(f"Columns: {list(df.columns)}")
print(f"\nSample data:")
print(df.head())

# Save the 10k sample
df.to_csv(output_file, index=False)
print(f"\n✓ Saved 10k sample to: {output_file}")
print(f"File size: {os.path.getsize(output_file) / 1024 / 1024:.2f} MB")
