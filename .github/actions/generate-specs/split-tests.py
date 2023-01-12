import os
from re import match
from json import dumps
from math import ceil

def find_files(search_path):
  files_list = []

  # Find all spec files for cypress tests
  for root, dir, files in os.walk(search_path):
    for file in files:
      if match(".*_spec.js$",file):
        files_list.append(os.path.join(root,file))
  return files_list

# Split to chunks based on the parallelism provided
def split(input_list, parallelism):
  chunk_size = ceil(len(input_list) / parallelism)
  for i in range(0, len(input_list), chunk_size):
    yield input_list[i:i + chunk_size]

parallelism = int(os.getenv("PARALLELISM"))
directory = os.getenv("DIRECTORY")
search_path = os.getenv("SEARCH_PATH")

os.chdir(directory)
files = find_files(search_path)
specs = []

# Generate JSON list of specs for GHA
for i,  spec_list in enumerate(split(files,parallelism)):
  specs.append(','.join(spec_list))

print(dumps(specs))