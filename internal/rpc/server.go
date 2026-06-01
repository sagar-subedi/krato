package rpc

import (
	"context"
	"time"

	"github.com/sagarsubedi/krato/internal/store"
)

type NodeServer struct {
	UnimplementedNodeServiceServer
	engine *store.Engine
	nodeID string
}

func NewNodeServer(id string, engine *store.Engine) *NodeServer {
	return &NodeServer{
		engine: engine,
		nodeID: id,
	}
}

func (s *NodeServer) Get(ctx context.Context, req *GetRequest) (*GetResponse, error) {
	val, err := s.engine.Get([]byte(req.Key))
	if err == store.ErrKeyNotFound {
		return &GetResponse{Found: false}, nil
	} else if err != nil {
		return nil, err
	}

	decodedVal, clock, err := store.DecodeVersionedValue(val)
	if err != nil {
		return &GetResponse{Value: val, Found: true, VectorClock: store.NewVectorClock()}, nil
	}

	return &GetResponse{Value: decodedVal, Found: true, VectorClock: clock}, nil
}

func (s *NodeServer) Set(ctx context.Context, req *SetRequest) (*SetResponse, error) {
	err := s.engine.SetVersioned([]byte(req.Key), req.Value, req.VectorClock, time.Duration(req.TtlMs)*time.Millisecond)
	if err != nil {
		return &SetResponse{Success: false}, err
	}
	return &SetResponse{Success: true}, nil
}

func (s *NodeServer) Delete(ctx context.Context, req *DeleteRequest) (*DeleteResponse, error) {
	err := s.engine.Delete([]byte(req.Key))
	if err != nil {
		return &DeleteResponse{Success: false}, err
	}
	return &DeleteResponse{Success: true}, nil
}

func (s *NodeServer) Ping(ctx context.Context, req *PingRequest) (*PingResponse, error) {
	return &PingResponse{NodeId: s.nodeID}, nil
}
