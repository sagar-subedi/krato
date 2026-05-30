package rpc

import (
	"context"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type Client struct {
	conn   *grpc.ClientConn
	client NodeServiceClient
}

func NewClient(addr string) (*Client, error) {
	conn, err := grpc.Dial(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}
	
	return &Client{
		conn:   conn,
		client: NewNodeServiceClient(conn),
	}, nil
}

func (c *Client) Close() error {
	return c.conn.Close()
}

func (c *Client) Get(ctx context.Context, key string) ([]byte, bool, error) {
	res, err := c.client.Get(ctx, &GetRequest{Key: key})
	if err != nil {
		return nil, false, err
	}
	return res.Value, res.Found, nil
}

func (c *Client) Set(ctx context.Context, key string, value []byte, ttlMs int64) error {
	_, err := c.client.Set(ctx, &SetRequest{
		Key:   key,
		Value: value,
		TtlMs: ttlMs,
	})
	return err
}

func (c *Client) Delete(ctx context.Context, key string) error {
	_, err := c.client.Delete(ctx, &DeleteRequest{Key: key})
	return err
}

func (c *Client) Ping(ctx context.Context, sourceID string) (string, error) {
	res, err := c.client.Ping(ctx, &PingRequest{SourceNodeId: sourceID})
	if err != nil {
		return "", err
	}
	return res.NodeId, nil
}
