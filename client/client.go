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
	apiVersion = "v1"
	manifestID = "com.mattermost.plugin-incident-response"
	userAgent  = "go-client/" + apiVersion
)

// Client manages communication with the workflows API.
type Client struct {
	client  *http.Client // HTTP client used to communicate with the API.
	BaseURL *url.URL

	// User agent used when communicating with the workflows API. Defaults to go-client.
	UserAgent string

	Incidents          *IncidentsService
	Playbooks          *PlaybooksService
	EventSubscriptions *EventSubscriptionsService
}

// ErrorResponse reports an error caused by an API request.
type ErrorResponse struct {
	Response *http.Response // HTTP response that caused this error
	Message  string         `json:"message"` // error message
	Details  string         `json:"details"` // more detail on the error
}

func (r *ErrorResponse) Error() string {
	return fmt.Sprintf("%v %v: %d %v %+v",
		r.Response.Request.Method, r.Response.Request.URL,
		r.Response.StatusCode, r.Message, r.Details)
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
	TotalCount int `json:"total_count"`
	PageCount  int `json:"page_count"`

	HasMore bool `json:"has_more"`
}

// SortDirection is the type used to specify the ascending or descending order of returned results.
type SortDirection string

const (
	// Desc is descending order.
	Desc SortDirection = "desc"

	// Asc is ascending order.
	Asc SortDirection = "asc"
)

// NewClient creates a new instance of Client.
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
	c.EventSubscriptions = &EventSubscriptionsService{c}
	return c, nil
}

// NewRequest creates an API request. A relative URL can be provided in urlStr,
// in which case it is resolved relative to the BaseURL of the Client.
// Relative URLs should always be specified without a preceding slash. If
// specified, the value pointed to by body is JSON encoded and included as the
// request body.
func (c *Client) NewRequest(method, urlStr string, body interface{}) (*http.Request, error) {
	u, err := c.BaseURL.Parse(buildAPIURL(urlStr))
	if err != nil {
		return nil, err
	}

	var buf io.ReadWriter
	if body != nil {
		buf = &bytes.Buffer{}
		enc := json.NewEncoder(buf)
		enc.SetEscapeHTML(false)
		if err = enc.Encode(body); err != nil {
			return nil, err
		}
	}

	req, err := http.NewRequest(method, u.String(), buf)
	if err != nil {
		return nil, err
	}

	if body != nil {
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
		// If we got an error, and the context has been canceled,
		// the context's error is probably more useful.
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
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
			io.Copy(w, resp.Body)
		} else {
			decErr := json.NewDecoder(resp.Body).Decode(v)
			if decErr == io.EOF {
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
// the 200 range or equal to 202 Accepted.
// API error responses are expected to have response
// body, and a JSON response body that maps to ErrorResponse.
func CheckResponse(r *http.Response) error {
	if r.StatusCode == http.StatusAccepted {
		return nil
	}
	if c := r.StatusCode; 200 <= c && c <= 299 {
		return nil
	}
	errorResponse := &ErrorResponse{Response: r}
	data, err := ioutil.ReadAll(r.Body)
	if err == nil && data != nil {
		json.Unmarshal(data, errorResponse)
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
		return s, err
	}

	qs, err := query.Values(opts)
	if err != nil {
		return s, err
	}

	u.RawQuery = qs.Encode()
	return u.String(), nil
}

func buildAPIURL(urlStr string) string {
	return fmt.Sprintf("plugins/%s/api/%s", manifestID, urlStr)
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
