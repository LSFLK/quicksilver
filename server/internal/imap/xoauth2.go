package imap

import "fmt"

// xoauth2Client implements github.com/emersion/go-sasl's Client interface for
// the XOAUTH2 mechanism, which go-sasl doesn't ship out of the box. It's the
// mechanism Gmail (and other Google Workspace) IMAP servers expect for
// OAuth2 bearer-token auth.
//
// The initial client response is the raw byte string
//
//	"user=" {email} ^A "auth=Bearer " {token} ^A ^A
//
// where ^A is the 0x01 control byte. go-imap base64-encodes the response on the
// wire, so we return the raw bytes here.
type xoauth2Client struct {
	username string
	token    string
}

func newXOAUTH2(username, token string) *xoauth2Client {
	return &xoauth2Client{username: username, token: token}
}

func (a *xoauth2Client) Start() (mech string, ir []byte, err error) {
	resp := fmt.Sprintf("user=%s\x01auth=Bearer %s\x01\x01", a.username, a.token)
	return "XOAUTH2", []byte(resp), nil
}

func (a *xoauth2Client) Next(challenge []byte) ([]byte, error) {
	// On an auth failure the server sends a base64 JSON error challenge and
	// expects an empty client response before returning the tagged NO. Replying
	// with an empty line lets go-imap surface the real error instead of hanging.
	return []byte{}, nil
}
