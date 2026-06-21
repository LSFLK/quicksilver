package handlers

import (
	"reflect"
	"testing"
)

func TestParseUIDList(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want []uint32
	}{
		{"empty", "", nil},
		{"single", "42", []uint32{42}},
		{"multiple", "1,2,3", []uint32{1, 2, 3}},
		{"whitespace", " 1 , 2 ,3 ", []uint32{1, 2, 3}},
		{"skips zero", "0,5,0,7", []uint32{5, 7}},
		{"skips malformed", "1,abc,3,,5", []uint32{1, 3, 5}},
		{"all invalid", "x,y,z", []uint32{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseUIDList(tt.in)
			if len(got) == 0 && len(tt.want) == 0 {
				return
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("parseUIDList(%q) = %v, want %v", tt.in, got, tt.want)
			}
		})
	}
}

func TestParseUIDListCapsInput(t *testing.T) {
	// Build a 1500-entry list; parser must cap the parsed set at 1000 so a
	// runaway query string can't force an unbounded FETCH.
	in := ""
	for i := 0; i < 1500; i++ {
		if i > 0 {
			in += ","
		}
		in += "1"
	}
	if got := len(parseUIDList(in)); got > 1000 {
		t.Errorf("parseUIDList did not cap input: got %d entries, want <= 1000", got)
	}
}
