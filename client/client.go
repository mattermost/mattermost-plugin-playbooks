// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"reflect"

	"github.com/google/go-querystring/query"
	"github.com/pkg/errors"
)

const (
	apiVersion = "v0"
	manifestID = "com.mattermost.plugin-incident-management"
	userAgent  = "go-client/" + apiVersion
)

// Client manages communication with the workflows API.
type Client struct {
	client  *http.Client // HTTP client used to communicate with the API.
	BaseURL *url.URL

	// User agent used when communicating with the workflows API. Defaults to go-client.
	UserAgent string

	Incidents *IncidentsService
	Playbooks *PlaybooksService
}

// ErrorResponse reports an error caused by an API request.
type ErrorResponse struct {
	Response *http.Response // HTTP response that caused this error
	Error    string         `json:"error"` // error message
}

func (r *ErrorResponse) Error() string {
	return fmt.Sprintf("%v %v: %d %v",
		r.Response.Request.Method, r.Response.Request.URL,
		r.Response.StatusCode, r.Error)
}

// ListOptions specifies the optional parameters to various List methods that
// support offset pagination.
type ListOptions struct {
	// For paginated result sets, page of results to retrieve. 0 based index.
	Page int `url:"page,omitempty"`

	// For paginated result sets, the number of results to include per page.
	PerPage int `url:"per_page,omitempty"`
}

// ListResult contains pagination data for List methods.
type ListResult struct {
	TotalCount int  `json:"total_count"`
	PageCount  int  `json:"page_count"`
	HasMore    bool `json:"has_more"`
}

// SortDirection is the type used to specify the ascending or descending order of returned results.
type SortDirection string

const (
	// Desc is descending order.
	Desc SortDirection = "desc"

	// Asc is ascending order.
	Asc SortDirection = "asc"
)

// NewClient creates a new instance of Client. If a nil httpClient is
// provided, a new http.Client will be used. To use API methods which require
// authentication, provide an http.Client that will perform the authentication
// for you (such as that provided by the golang.org/x/oauth2 library).
func NewClient(mattermostSiteURL string, httpClient *http.Client) (*Client, error) {
	if httpClient == nil {
		httpClient = &http.Client{}
	}

	siteURL, err := url.Parse(mattermostSiteURL)
	if err != nil {
		return nil, err
	}

	c := &Client{client: httpClient, BaseURL: siteURL, UserAgent: userAgent}
	c.Incidents = &IncidentsService{c}
	c.Playbooks = &PlaybooksService{c}
	return c, nil
}

// NewRequest creates an API request. A relative URL can be provided in urlStr,
// in which case it is resolved relative to the BaseURL of the Client.
// Relative URLs should always be specified without a preceding slash. If
// specified, the body parameter is JSON encoded.
func (c *Client) NewRequest(method, urlStr string, body interface{}) (*http.Request, error) {
	u, err := c.BaseURL.Parse(buildAPIURL(urlStr))
	if err != nil {
		return nil, errors.Wrapf(err, "failed to urlStr %s", urlStr)
	}

	var buf io.ReadWriter
	if body != nil {
		buf = &bytes.Buffer{}
		enc := json.NewEncoder(buf)
		enc.SetEscapeHTML(false)
		err = enc.Encode(body)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to encode body %s", body)
		}
	}

	req, err := http.NewRequest(method, u.String(), buf)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to create request for url %s", u)
	}

	if buf != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.UserAgent != "" {
		req.Header.Set("User-Agent", c.UserAgent)
	}
	return req, nil
}

// Do sends an API request and returns the API response. The API response is
// JSON decoded and stored in the value pointed to by v, or returned as an
// error if an API error has occurred. If v implements the io.Writer
// interface, the raw response body will be written to v, without attempting to
// first decode it.
//
// The provided ctx must be non-nil, if it is nil an error is returned. If it is canceled or times out,
// ctx.Err() will be returned.
func (c *Client) Do(ctx context.Context, req *http.Request, v interface{}) (*http.Response, error) {
	if ctx == nil {
		return nil, errors.New("context must be non-nil")
	}
	req = req.WithContext(ctx)

	resp, err := c.client.Do(req)
	if err != nil {
		select {
		case <-ctx.Done():
			return nil, errors.Wrapf(ctx.Err(), "client err=%s", err.Error())
		default:
		}

		return nil, err
	}
	defer resp.Body.Close()

	err = CheckResponse(resp)
	if err != nil {
		return resp, err
	}

	if v != nil {
		if w, ok := v.(io.Writer); ok {
			if _, err = io.Copy(w, resp.Body); err != nil {
				return nil, err
			}
		} else {
			decErr := json.NewDecoder(resp.Body).Decode(v)
			if decErr == io.EOF {
				// TODO: Confirm if this happens only on empty bodies. If so, check that first before decoding.
				decErr = nil // ignore EOF errors caused by empty response body
			}
			if decErr != nil {
				err = decErr
			}
		}
	}

	return resp, err
}

// CheckResponse checks the API response for errors, and returns them if
// present. A response is considered an error if it has a status code outside
// the 200 range.
// API error responses are expected to have response
// body, and a JSON response body that maps to ErrorResponse.
func CheckResponse(r *http.Response) error {
	if c := r.StatusCode; http.StatusOK <= c && c <= 299 {
		return nil
	}
	errorResponse := &ErrorResponse{Response: r}
	data, err := ioutil.ReadAll(r.Body)
	if err == nil && data != nil {
		if err := json.Unmarshal(data, errorResponse); err != nil {
			return err
		}
	}
	r.Body = ioutil.NopCloser(bytes.NewBuffer(data))

	return errorResponse
}

// addOptions adds the parameters in opts as URL query parameters to s. opts
// must be a struct whose fields may contain "url" tags.
func addOptions(s string, opts interface{}) (string, error) {
	v := reflect.ValueOf(opts)
	if v.Kind() == reflect.Ptr && v.IsNil() {
		return s, nil
	}

	u, err := url.Parse(s)
	if err != nil {
		return s, errors.Wrapf(err, "failed to parse %s", s)
	}

	qs, err := query.Values(opts)
	if err != nil {
		return s, errors.Wrapf(err, "failed to opts %+v", opts)
	}

	u.RawQuery = qs.Encode()
	return u.String(), nil
}

func buildAPIURL(urlStr string) string {
	return fmt.Sprintf("plugins/%s/api/%s/%s", manifestID, apiVersion, urlStr)
}

// Bool is a helper routine that allocates a new bool value
// to store v and returns a pointer to it.
func Bool(v bool) *bool { return &v }

// Int is a helper routine that allocates a new int value
// to store v and returns a pointer to it.
func Int(v int) *int { return &v }

// Int64 is a helper routine that allocates a new int64 value
// to store v and returns a pointer to it.
func Int64(v int64) *int64 { return &v }

// String is a helper routine that allocates a new string value
// to store v and returns a pointer to it.
func String(v string) *string { return &v }
