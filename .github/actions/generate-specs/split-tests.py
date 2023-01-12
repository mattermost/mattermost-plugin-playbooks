import os
from re import match
from json import dumps
from math import ceil

def find_files(search_path):
  result = []

  # Find all spec files for cypress tests
  for root, dir, files in os.walk(search_path):
    for file in files:
      if match(".*_spec.js$",file):
        result.append(os.path.join(root,file))
  return result

def split(input_list, parallelism):
  # Split to chunks based on the parallelism provided
  chunk_size = ceil(len(input_list) / parallelism)
  for i in range(0, len(input_list), chunk_size):
    yield input_list[i:i + chunk_size]

parallelism = int(os.getenv("PARALLELISM"))
directory = os.getenv("DIRECTORY")
search_path = os.getenv("SEARCH_PATH")

os.chdir(directory)
files = find_files(search_path)
endMatrix = {
  "include": []
}


# Generate JSON matrix for GHA
for i,  spec_list in enumerate(split(files,parallelism)):
  specs = {"specs": ','.join(spec_list)}
  endMatrix["include"].append(specs)

print(dumps(endMatrix))