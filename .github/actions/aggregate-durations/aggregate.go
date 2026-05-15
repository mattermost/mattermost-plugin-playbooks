// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// aggregate.go merges per-spec durations recorded by Cypress's after:spec
// hook (results/durations.jsonl) across all e2e shards into a single
// durations.json keyed by spec path with values in seconds.
//
// Inputs:
//   -artifacts: directory containing downloaded shard artifacts; the tool
//               recursively finds any "durations.jsonl" within.
//   -prior:     optional existing durations.json to merge with; values from
//               the current run overwrite, but specs not seen in this run
//               keep their prior value so a single skipped/quarantined spec
//               doesn't lose its baseline.
//   -out:       output path (default durations.json).
package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

type record struct {
	Spec       string  `json:"spec"`
	DurationMs float64 `json:"durationMs"`
}

func main() {
	artifacts := flag.String("artifacts", "", "directory containing downloaded shard artifacts")
	prior := flag.String("prior", "", "optional path to prior durations.json")
	out := flag.String("out", "durations.json", "output path for merged durations.json")
	flag.Parse()

	merged := map[string]float64{}

	if *prior != "" {
		if b, err := os.ReadFile(*prior); err == nil && len(b) > 0 {
			if err := json.Unmarshal(b, &merged); err != nil {
				fmt.Fprintf(os.Stderr, "aggregate: ignoring unreadable prior durations: %v\n", err)
				merged = map[string]float64{}
			}
		}
	}

	thisRun := map[string]float64{}
	if *artifacts != "" {
		err := filepath.WalkDir(*artifacts, func(p string, d fs.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return nil
			}
			if !strings.HasSuffix(p, "durations.jsonl") {
				return nil
			}
			f, err := os.Open(p)
			if err != nil {
				fmt.Fprintf(os.Stderr, "aggregate: skipping %s: %v\n", p, err)
				return nil
			}
			defer f.Close()

			sc := bufio.NewScanner(f)
			sc.Buffer(make([]byte, 1024*1024), 1024*1024)
			for sc.Scan() {
				line := strings.TrimSpace(sc.Text())
				if line == "" {
					continue
				}
				var r record
				if err := json.Unmarshal([]byte(line), &r); err != nil {
					continue
				}
				if r.Spec == "" || r.DurationMs <= 0 {
					continue
				}
				// Last-write wins per spec within a run (retries reuse the
				// final value emitted by Cypress's after:spec).
				thisRun[r.Spec] = r.DurationMs / 1000.0
			}
			return nil
		})
		if err != nil {
			fmt.Fprintln(os.Stderr, "aggregate: walk error:", err)
		}
	}

	for spec, v := range thisRun {
		merged[spec] = v
	}

	if len(merged) == 0 {
		fmt.Fprintln(os.Stderr, "aggregate: no durations gathered; refusing to write empty durations.json")
		os.Exit(1)
	}

	b, err := json.MarshalIndent(merged, "", "  ")
	if err != nil {
		panic(err)
	}
	if err := os.WriteFile(*out, b, 0o644); err != nil {
		panic(err)
	}
	fmt.Fprintf(os.Stderr, "aggregate: wrote %s (%d specs, %d updated this run)\n", *out, len(merged), len(thisRun))
}
