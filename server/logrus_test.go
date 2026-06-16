// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"io"
	"sync"
	"testing"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
)

type noopLogrusHook struct{}

func (noopLogrusHook) Levels() []logrus.Level {
	return logrus.AllLevels
}

func (noopLogrusHook) Fire(*logrus.Entry) error {
	return nil
}

func TestConfigureLogrus(t *testing.T) {
	logger := logrus.New()

	configureLogrus(logger, noopLogrusHook{})

	for _, level := range logrus.AllLevels {
		require.Len(t, logger.Hooks[level], 1)
		_, ok := logger.Hooks[level][0].(noopLogrusHook)
		require.True(t, ok)
	}
	require.Equal(t, io.Discard, logger.Out)
	require.True(t, logger.ReportCaller)
	require.Equal(t, logrus.TraceLevel, logger.GetLevel())
}

func TestConfigureLogrusConcurrentWithLogging(t *testing.T) {
	// Regression test for MM-52096. Run with -race to verify hook registration
	// stays safe while other goroutines are logging.
	logger := logrus.New()
	logger.SetOutput(io.Discard)
	logger.SetLevel(logrus.TraceLevel)

	start := make(chan struct{})
	var wg sync.WaitGroup

	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start

			for j := 0; j < 1000; j++ {
				logger.WithField("iteration", j).Info("test log")
			}
		}()
	}

	wg.Add(1)
	go func() {
		defer wg.Done()
		<-start

		for i := 0; i < 100; i++ {
			configureLogrus(logger, noopLogrusHook{})
		}
	}()

	close(start)
	wg.Wait()

	require.Equal(t, io.Discard, logger.Out)
	require.True(t, logger.ReportCaller)
	require.Equal(t, logrus.TraceLevel, logger.GetLevel())
}
