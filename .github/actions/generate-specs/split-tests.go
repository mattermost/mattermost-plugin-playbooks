// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"
	"fmt"
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
	fipsEnabled  bool
	rawFiles     []string
	groupedFiles []SpecGroup
}

type SpecGroup struct {
	RunID string `json:"runId"`
	Specs string `json:"specs"`
	FIPS  bool   `json:"fips"`
}

type Output struct {
	Include []SpecGroup `json:"include"`
}

func newSpecGroup(runId string, specs string, fips bool) *SpecGroup {
	return &SpecGroup{
		RunID: runId,
		Specs: specs,
		FIPS:  fips,
	}
}

func newSpecs(directory string, searchPath string, parallelism int, fipsEnabled bool) *Specs {
	return &Specs{
		directory:   directory,
		searchPath:  searchPath,
		parallelism: parallelism,
		fipsEnabled: fipsEnabled,
	}
}

func (s *Specs) findFiles() {
	fileSystem := os.DirFS(filepath.Join(s.directory, s.searchPath))

	err := fs.WalkDir(fileSystem, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		// Find all files matching _spec.(js|ts)
		r := regexp.MustCompile(".*_spec.(js|ts)$")
		if r.MatchString(path) {
			s.rawFiles = append(s.rawFiles, filepath.Join(s.searchPath, path))
		}
		return nil
	})
	if err != nil {
		panic(err)
	}
}

func (s *Specs) generateSplits() {
	// Split to chunks based on the parallelism provided
	chunkSize := int(math.Ceil(float64(len(s.rawFiles)) / float64(s.parallelism)))
	runNo := 1
	// We can figure out a more sophisticated way to split the tests
	// We can use metadata in order to group them manually
	for i := 0; i <= len(s.rawFiles); i += chunkSize {
		end := i + chunkSize
		if end > len(s.rawFiles) {
			end = len(s.rawFiles)
		}

		fileGroup := strings.Join(s.rawFiles[i:end], ",")

		// Generate both non-FIPS and FIPS variants
		nonFipsGroup := newSpecGroup(fmt.Sprintf("%d", runNo), fileGroup, false)
		s.groupedFiles = append(s.groupedFiles, *nonFipsGroup)

		if s.fipsEnabled {
			fipsGroup := newSpecGroup(fmt.Sprintf("%d-fips", runNo), fileGroup, true)
			s.groupedFiles = append(s.groupedFiles, *fipsGroup)
		}

		// Break when we reach the end to avoid duplicate groups
		if end == len(s.rawFiles) {
			break
		}

		runNo++
	}
}

func (s *Specs) dumpSplits() {
	// Dump json format for GitHub actions
	o := &Output{
		Include: s.groupedFiles,
	}
	b, err := json.Marshal(o)
	if err != nil {
		panic(err)
	}
	os.Stdout.Write(b)
}

func main() {
	searchPath := os.Getenv("SEARCH_PATH")
	directory := os.Getenv("DIRECTORY")
	parallelism, _ := strconv.Atoi(os.Getenv("PARALLELISM"))
	fipsEnabled := os.Getenv("FIPS_ENABLED") == "true"

	specs := newSpecs(directory, searchPath, parallelism, fipsEnabled)
	specs.findFiles()
	specs.generateSplits()
	specs.dumpSplits()
}
