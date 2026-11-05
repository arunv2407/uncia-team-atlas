"""Read the supplied workbook without modifying it. Output stays in ignored local data."""
import datetime
import hashlib
import json
import pathlib
import sys
import openpyxl

source, destination = map(pathlib.Path, sys.argv[1:3])
workbook = openpyxl.load_workbook(source, read_only=True, data_only=True)
sheet = workbook['Master Sheet']
values = list(sheet.values)
headers = values[0]
required = ['Emp id', 'Name', 'Current Designation', 'Recommended Designation - Function', 'Function', 'Reporting Manager']
assert all(field in headers for field in required), 'Unexpected workbook headers'

def text(value):
    if value is None:
        return ''
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.isoformat()[:10]
    if isinstance(value, float):
        return format(value, '.12g')
    return str(value).strip()

rows = []
for number, row in enumerate(values[1:], 2):
    record = {str(header): text(value) for header, value in zip(headers, row) if header}
    if record.get('Name'):
        rows.append({'row': number, **record})
result = {'source': source.name, 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'sheet': sheet.title, 'rows': rows}
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'rows': len(rows), 'destination': str(destination)}))
