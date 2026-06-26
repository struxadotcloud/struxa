package wings

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type Client struct {
	baseURL string
	token   string
	hc      *http.Client
}

func New(scheme, fqdn string, port int, token string) *Client {
	if scheme != "http" && scheme != "https" {
		scheme = "https"
	}
	return &Client{
		baseURL: fmt.Sprintf("%s://%s:%d", scheme, fqdn, port),
		token:   token,
		hc:      &http.Client{},
	}
}

func (c *Client) do(method, path string, body any) (*http.Response, error) {
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reader = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, c.baseURL+path, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Struxa/1.0")
	resp, err := c.hc.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		resp.Body.Close()
		return nil, fmt.Errorf("wings error %d %s", resp.StatusCode, path)
	}
	return resp, nil
}

type UtilizationEntry struct {
	State string `json:"state"`
}

func (c *Client) GetUtilization() (map[string]UtilizationEntry, error) {
	resp, err := c.do("GET", "/api/servers/utilization", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result map[string]UtilizationEntry
	return result, json.NewDecoder(resp.Body).Decode(&result)
}

func (c *Client) SendPowerAction(uuid, action string) error {
	resp, err := c.do("POST", "/api/servers/"+uuid+"/power", map[string]string{"action": action})
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

func (c *Client) SendCommands(uuid string, commands []string) error {
	resp, err := c.do("POST", "/api/servers/"+uuid+"/commands", map[string][]string{"commands": commands})
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

type BackupPayload struct {
	UUID    string `json:"uuid"`
	Ignore  string `json:"ignore"`
	Adapter string `json:"adapter"`
}

func (c *Client) CreateBackup(uuid string, payload BackupPayload) error {
	resp, err := c.do("POST", "/api/servers/"+uuid+"/backup", payload)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}
