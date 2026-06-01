package main

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/google/generative-ai-go/genai"
	"github.com/spf13/cobra"
	"google.golang.org/api/option"
)

var aiCmd = &cobra.Command{
	Use:   "ai",
	Short: "Start an interactive AI session powered by Gemini to manage the Krato cluster.",
	Run: func(cmd *cobra.Command, args []string) {
		apiKey := os.Getenv("GEMINI_API_KEY")
		if apiKey == "" {
			fmt.Println("Error: GEMINI_API_KEY environment variable is required.")
			os.Exit(1)
		}

		ctx := context.Background()
		client, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
		if err != nil {
			fmt.Printf("Failed to create Gemini client: %v\n", err)
			os.Exit(1)
		}
		defer client.Close()

		model := client.GenerativeModel("gemini-2.5-flash")

		readTool := &genai.Tool{
			FunctionDeclarations: []*genai.FunctionDeclaration{{
				Name:        "read_key",
				Description: "Reads the value associated with a specific key from the Krato distributed cluster.",
				Parameters: &genai.Schema{
					Type: genai.TypeObject,
					Properties: map[string]*genai.Schema{
						"key": {
							Type:        genai.TypeString,
							Description: "The exact key string to read.",
						},
					},
					Required: []string{"key"},
				},
			}},
		}

		writeTool := &genai.Tool{
			FunctionDeclarations: []*genai.FunctionDeclaration{{
				Name:        "write_key",
				Description: "Writes or updates a value for a specific key in the Krato cluster.",
				Parameters: &genai.Schema{
					Type: genai.TypeObject,
					Properties: map[string]*genai.Schema{
						"key": {
							Type:        genai.TypeString,
							Description: "The key to write to.",
						},
						"value": {
							Type:        genai.TypeString,
							Description: "The value to store.",
						},
					},
					Required: []string{"key", "value"},
				},
			}},
		}

		model.Tools = []*genai.Tool{readTool, writeTool}

		session := model.StartChat()
		session.History = []*genai.Content{{
			Role: "user",
			Parts: []genai.Part{
				genai.Text("You are an intelligent administrative AI for Krato, a highly available distributed Key-Value store. You can query values using your read_key tool and modify data using the write_key tool. Keep responses concise."),
			},
		}, {
			Role: "model",
			Parts: []genai.Part{
				genai.Text("Understood. I am Krato's Administrative AI Agent. How can I assist you?"),
			},
		}}

		fmt.Println("Krato AI initialized (Gemini). Type 'exit' to quit.")
		scanner := bufio.NewScanner(os.Stdin)

		for {
			fmt.Print("krato-ai> ")
			if !scanner.Scan() {
				break
			}
			text := strings.TrimSpace(scanner.Text())
			if text == "exit" || text == "quit" {
				break
			}
			if text == "" {
				continue
			}

			resp, err := session.SendMessage(ctx, genai.Text(text))
			if err != nil {
				fmt.Printf("Error communicating with Gemini: %v\n", err)
				continue
			}

			for {
				calledFunction := false
				var functionResponses []genai.Part

				for _, part := range resp.Candidates[0].Content.Parts {
					if fc, ok := part.(genai.FunctionCall); ok {
						calledFunction = true
						if fc.Name == "read_key" {
							key, _ := fc.Args["key"].(string)
							val := queryLocalCluster(key)
							functionResponses = append(functionResponses, genai.FunctionResponse{
								Name: "read_key",
								Response: map[string]any{
									"result": val,
								},
							})
						} else if fc.Name == "write_key" {
							key, _ := fc.Args["key"].(string)
							value, _ := fc.Args["value"].(string)
							val := writeLocalCluster(key, value)
							functionResponses = append(functionResponses, genai.FunctionResponse{
								Name: "write_key",
								Response: map[string]any{
									"result": val,
								},
							})
						}
					}
				}

				if !calledFunction {
					break
				}

				resp, err = session.SendMessage(ctx, functionResponses...)
				if err != nil {
					fmt.Printf("Error sending function response: %v\n", err)
					break
				}
			}

			for _, part := range resp.Candidates[0].Content.Parts {
				if txt, ok := part.(genai.Text); ok {
					fmt.Println(txt)
				}
			}
		}
	},
}

func queryLocalCluster(key string) string {
	res, err := http.Get(fmt.Sprintf("%s/keys/%s", apiURL, key))
	if err != nil {
		return fmt.Sprintf("Error: %v", err)
	}
	defer res.Body.Close()

	if res.StatusCode == http.StatusNotFound {
		return "Key not found."
	}
	b, _ := io.ReadAll(res.Body)
	if res.StatusCode != http.StatusOK {
		return fmt.Sprintf("Server Error: %s", string(b))
	}
	return string(b)
}

func writeLocalCluster(key, value string) string {
	req, _ := http.NewRequest(http.MethodPut, fmt.Sprintf("%s/keys/%s", apiURL, key), bytes.NewBufferString(value))
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Sprintf("Error: %v", err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(res.Body)
		return fmt.Sprintf("Error: %s", string(b))
	}
	return "Successfully written data."
}

func init() {
	rootCmd.AddCommand(aiCmd)
}
