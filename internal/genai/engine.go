package genai

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/google/generative-ai-go/genai"
	"github.com/sagarsubedi/krato/internal/coordinator"
	"github.com/sagarsubedi/krato/internal/observe"
	"google.golang.org/api/option"
)

type Engine struct {
	client  *genai.Client
	model   *genai.GenerativeModel
	coord   *coordinator.Coordinator
	events  *observe.EventBus
	metrics *observe.Metrics
}

func NewEngine(ctx context.Context, apiKey string, coord *coordinator.Coordinator, events *observe.EventBus, metrics *observe.Metrics) (*Engine, error) {
	client, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		return nil, err
	}

	model := client.GenerativeModel("gemini-1.5-flash-latest")

	e := &Engine{
		client:  client,
		model:   model,
		coord:   coord,
		events:  events,
		metrics: metrics,
	}

	model.Tools = []*genai.Tool{
		{
			FunctionDeclarations: []*genai.FunctionDeclaration{
				{
					Name:        "get_cluster_ring",
					Description: "Get the current consistent hash ring snapshot showing key distribution across nodes.",
				},
				{
					Name:        "get_cluster_nodes",
					Description: "Get the status and metrics of all nodes in the cluster.",
				},
				{
					Name:        "get_event_history",
					Description: "Get recent cluster events like gossip, replication, and node status changes.",
				},
				{
					Name:        "get_chaos_status",
					Description: "Check if any chaos experiments (latency injection or node kills) are active.",
				},
			},
		},
	}

	return e, nil
}

func (e *Engine) Chat(ctx context.Context, message string, out chan<- string) error {
	session := e.model.StartChat()

	// Optional: Add system instruction if supported by the model version
	// e.model.SystemInstruction = ...

	for {
		resp, err := session.SendMessage(ctx, genai.Text(message))
		if err != nil {
			return err
		}

		for {
			part := resp.Candidates[0].Content.Parts[0]
			if fn, ok := part.(genai.FunctionCall); ok {
				result, err := e.handleFunctionCall(ctx, fn)
				if err != nil {
					return err
				}

				resp, err = session.SendMessage(ctx, genai.FunctionResponse{
					Name:     fn.Name,
					Response: result,
				})
				if err != nil {
					return err
				}
				continue // Check the next response from Gemini
			}

			if text, ok := part.(genai.Text); ok {
				out <- string(text)
				return nil
			}

			return fmt.Errorf("unexpected model response type: %T", part)
		}
	}
}

func (e *Engine) handleFunctionCall(ctx context.Context, fn genai.FunctionCall) (map[string]any, error) {
	slog.Info("AI calling tool", "name", fn.Name)

	switch fn.Name {
	case "get_cluster_ring":
		return map[string]any{"ring": e.coord.Ring().GetSnapshot()}, nil
	case "get_cluster_nodes":
		return map[string]any{
			"nodes":   e.coord.Ring().GetAllNodes(),
			"metrics": e.metrics.GetSnapshot(),
		}, nil
	case "get_event_history":
		return map[string]any{"events": e.events.GetHistory()}, nil
	case "get_chaos_status":
		return map[string]any{"chaos": e.coord.GetChaos()}, nil
	default:
		return nil, fmt.Errorf("unknown function: %s", fn.Name)
	}
}

func (e *Engine) Close() {
	e.client.Close()
}
