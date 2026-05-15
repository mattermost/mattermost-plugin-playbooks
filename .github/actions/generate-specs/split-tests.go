// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

type Specs struct {
	searchPath    string
	directory     string
	parallelism   int
	durationsFile string
	rawFiles      []string
	groupedFiles  []SpecGroup
}

type SpecGroup struct {
	RunID string `json:"runId"`
	Specs string `json:"specs"`
}

type Output struct {
	Include []SpecGroup `json:"include"`
}

func newSpecGroup(runId string, specs string) *SpecGroup {
	return &SpecGroup{
		RunID: runId,
		Specs: specs,
	}
}

func newSpecs(directory, searchPath string, parallelism int, durationsFile string) *Specs {
	return &Specs{
		directory:     directory,
		searchPath:    searchPath,
		parallelism:   parallelism,
		durationsFile: durationsFile,
	}
}

func (s *Specs) findFiles() {
	fileSystem := os.DirFS(filepath.Join(s.directory, s.searchPath))

	r := regexp.MustCompile(`.*_spec\.(js|ts)$`)
	err := fs.WalkDir(fileSystem, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if r.MatchString(path) {
			s.rawFiles = append(s.rawFiles, filepath.Join(s.searchPath, path))
		}
		return nil
	})
	if err != nil {
		panic(err)
	}
}

// loadDurations returns the per-spec runtime map (seconds) from the cached
// durations file, or nil if the file is missing/empty/invalid. Any of those
// outcomes cause a fallback to round-robin splitting.
func (s *Specs) loadDurations() map[string]float64 {
	if s.durationsFile == "" {
		return nil
	}
	b, err := os.ReadFile(s.durationsFile)
	if err != nil || len(b) == 0 {
		fmt.Fprintf(os.Stderr, "split-tests: durations file unavailable (%v); using round-robin\n", err)
		return nil
	}
	d := map[string]float64{}
	if err := json.Unmarshal(b, &d); err != nil || len(d) == 0 {
		fmt.Fprintf(os.Stderr, "split-tests: durations file invalid or empty; using round-robin\n")
		return nil
	}
	return d
}

func median(d map[string]float64) float64 {
	if len(d) == 0 {
		return 0
	}
	vs := make([]float64, 0, len(d))
	for _, v := range d {
		if v > 0 {
			vs = append(vs, v)
		}
	}
	if len(vs) == 0 {
		return 0
	}
	sort.Float64s(vs)
	mid := len(vs) / 2
	if len(vs)%2 == 0 {
		return (vs[mid-1] + vs[mid]) / 2
	}
	return vs[mid]
}

func (s *Specs) generateSplits() {
	// Guard against zero/negative parallelism: degrade to a single shard.
	if s.parallelism < 1 {
		fmt.Fprintf(os.Stderr, "split-tests: parallelism %d invalid; coercing to 1\n", s.parallelism)
		s.parallelism = 1
	}

	if len(s.rawFiles) == 0 {
		for i := 0; i < s.parallelism; i++ {
			s.groupedFiles = append(s.groupedFiles, *newSpecGroup(fmt.Sprintf("%d", i+1), ""))
		}
		return
	}

	if d := s.loadDurations(); len(d) > 0 {
		s.lpt(d)
		return
	}
	s.roundRobin()
}

// roundRobin assigns spec i to shard (i % parallelism). It spreads
// alphabetically-clustered specs across shards without needing duration data,
// and is the fallback when no durations cache is available.
func (s *Specs) roundRobin() {
	buckets := make([][]string, s.parallelism)
	for i, f := range s.rawFiles {
		shard := i % s.parallelism
		buckets[shard] = append(buckets[shard], f)
	}
	for i, b := range buckets {
		s.groupedFiles = append(s.groupedFiles, *newSpecGroup(
			fmt.Sprintf("%d", i+1),
			strings.Join(b, ","),
		))
	}
}

// lpt packs specs into shards using Longest-Processing-Time-first: sort
// descending by recorded cost, then repeatedly assign the next spec to the
// currently-lightest shard. Specs with no recorded duration (new files,
// renames) get the median cost so they don't pile onto one shard.
func (s *Specs) lpt(durations map[string]float64) {
	defaultCost := median(durations)
	if defaultCost <= 0 {
		defaultCost = 1
	}

	type spec struct {
		path string
		cost float64
	}
	specs := make([]spec, len(s.rawFiles))
	unknown := 0
	for i, f := range s.rawFiles {
		c, ok := durations[f]
		if !ok || c <= 0 {
			c = defaultCost
			unknown++
		}
		specs[i] = spec{f, c}
	}

	sort.SliceStable(specs, func(i, j int) bool { return specs[i].cost > specs[j].cost })

	loads := make([]float64, s.parallelism)
	buckets := make([][]string, s.parallelism)
	for _, sp := range specs {
		min := 0
		for i := 1; i < s.parallelism; i++ {
			if loads[i] < loads[min] {
				min = i
			}
		}
		buckets[min] = append(buckets[min], sp.path)
		loads[min] += sp.cost
	}

	fmt.Fprintf(os.Stderr, "split-tests: LPT split (%d known, %d defaulted to median=%.1fs)\n",
		len(specs)-unknown, unknown, defaultCost)
	for i, b := range buckets {
		sort.Strings(b)
		s.groupedFiles = append(s.groupedFiles, *newSpecGroup(
			fmt.Sprintf("%d", i+1),
			strings.Join(b, ","),
		))
		fmt.Fprintf(os.Stderr, "split-tests: shard %d -> %.1fs across %d specs\n", i+1, loads[i], len(b))
	}
}

func (s *Specs) dumpSplits() {
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
	durationsFile := os.Getenv("DURATIONS_FILE")

	specs := newSpecs(directory, searchPath, parallelism, durationsFile)
	specs.findFiles()
	specs.generateSplits()
	specs.dumpSplits()
}
