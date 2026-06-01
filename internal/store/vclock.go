package store

import (
	"encoding/json"
	"fmt"
)

type VectorClock map[string]int64

func NewVectorClock() VectorClock {
	return make(VectorClock)
}

func (vc VectorClock) Copy() VectorClock {
	c := make(VectorClock)
	for k, v := range vc {
		c[k] = v
	}
	return c
}

func (vc VectorClock) Increment(nodeID string) {
	vc[nodeID]++
}

func (vc VectorClock) Merge(other VectorClock) {
	for k, v := range other {
		if vc[k] < v {
			vc[k] = v
		}
	}
}

func (vc VectorClock) Compare(other VectorClock) int {
	isGreater := false
	isLess := false

	for k, v1 := range vc {
		v2 := other[k]
		if v1 > v2 {
			isGreater = true
		} else if v1 < v2 {
			isLess = true
		}
	}

	for k, v2 := range other {
		if _, exists := vc[k]; !exists && v2 > 0 {
			isLess = true
		}
	}

	if isGreater && !isLess {
		return 1
	}
	if isLess && !isGreater {
		return -1
	}
	if !isGreater && !isLess {
		return 0
	}
	return 2
}

type VersionedValue struct {
	Value []byte      `json:"value"`
	Clock VectorClock `json:"clock"`
}

func EncodeVersionedValue(val []byte, clock VectorClock) ([]byte, error) {
	return json.Marshal(VersionedValue{Value: val, Clock: clock})
}

func DecodeVersionedValue(data []byte) ([]byte, VectorClock, error) {
	var vv VersionedValue
	if err := json.Unmarshal(data, &vv); err != nil {
		return data, NewVectorClock(), fmt.Errorf("not a versioned value")
	}
	if vv.Clock == nil {
		vv.Clock = NewVectorClock()
	}
	return vv.Value, vv.Clock, nil
}
