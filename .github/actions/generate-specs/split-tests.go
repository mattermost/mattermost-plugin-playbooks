package main

import (
	"encoding/json"
	"io/fs"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

type Specs struct {
	searchPath   string
	directory    string
	parallelism  int
	rawFiles     []string
	groupedFiles []string
}

func newSpecs(directory string, searchPath string, parallelism int) *Specs {
	return &Specs{
		directory:   directory,
		searchPath:  searchPath,
		parallelism: parallelism,
	}
}

func (s *Specs) findFiles() {
	fileSystem := os.DirFS(filepath.Join(s.directory, s.searchPath))

	fs.WalkDir(fileSystem, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		// Find all files matching _spec.js
		r, _ := regexp.Compile(".*_spec.js$")
		if err != nil {
			return err
		}
		if r.MatchString(path) {
			s.rawFiles = append(s.rawFiles, filepath.Join(s.searchPath, path))
		}
		return nil
	})
}

func (s *Specs) generateSplits() {
	// Split to chunks based on the parallelism provided
	chunkSize := math.Ceil(float64(len(s.rawFiles)) / float64(s.parallelism))

	// We can figure out a more sofisticated way to split the tests
	// We can use metadata in order to group them manually
	for i := 0; i <= len(s.rawFiles); i += int(chunkSize) {
		end := i + int(chunkSize)
		if end > len(s.rawFiles) {
			end = len(s.rawFiles)
		}

		fileGroup := strings.Join(s.rawFiles[i:end], ",")
		s.groupedFiles = append(s.groupedFiles, fileGroup)
		// Break when we reach the end to avoid duplicate groups
		if end == len(s.rawFiles) {
			break
		}
	}
}

func (s *Specs) dumpSplits() {
	// Dump jaon format for Github actions
	b, _ := json.Marshal(s.groupedFiles)
	os.Stdout.Write(b)
}

func main() {
	searchPath := os.Getenv("SEARCH_PATH")
	directory := os.Getenv("DIRECTORY")
	parallelism, _ := strconv.Atoi(os.Getenv("PARALLELISM"))

	specs := newSpecs(directory, searchPath, parallelism)
	specs.findFiles()
	specs.generateSplits()
	specs.dumpSplits()
}
