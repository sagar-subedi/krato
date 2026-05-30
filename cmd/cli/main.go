package main

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/spf13/cobra"
)

var apiURL string

var rootCmd = &cobra.Command{
	Use:   "krato",
	Short: "Krato CLI client",
}

var getCmd = &cobra.Command{
	Use:   "get [key]",
	Short: "Get a value by key",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		res, err := http.Get(fmt.Sprintf("%s/keys/%s", apiURL, args[0]))
		if err != nil {
			fmt.Printf("Error: %v\n", err)
			return
		}
		defer res.Body.Close()
		
		if res.StatusCode == http.StatusNotFound {
			fmt.Println("Error: key not found")
			return
		}

		b, _ := io.ReadAll(res.Body)
		if res.StatusCode != http.StatusOK {
			fmt.Printf("Error: %s\n", string(b))
			return
		}
		fmt.Println(string(b))
	},
}

var setCmd = &cobra.Command{
	Use:   "set [key] [value]",
	Short: "Set a value by key",
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		req, _ := http.NewRequest(http.MethodPut, fmt.Sprintf("%s/keys/%s", apiURL, args[0]), bytes.NewBufferString(args[1]))
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
			return
		}
		defer res.Body.Close()

		if res.StatusCode != http.StatusCreated {
			b, _ := io.ReadAll(res.Body)
			fmt.Printf("Error: %s\n", string(b))
			return
		}
		fmt.Println("OK")
	},
}

var deleteCmd = &cobra.Command{
	Use:   "delete [key]",
	Short: "Delete a value by key",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		req, _ := http.NewRequest(http.MethodDelete, fmt.Sprintf("%s/keys/%s", apiURL, args[0]), nil)
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
			return
		}
		defer res.Body.Close()

		if res.StatusCode != http.StatusOK {
			b, _ := io.ReadAll(res.Body)
			fmt.Printf("Error: %s\n", string(b))
			return
		}
		fmt.Println("OK")
	},
}

func init() {
	rootCmd.PersistentFlags().StringVar(&apiURL, "api", "http://localhost:8080", "Krato API URL")
	rootCmd.AddCommand(getCmd)
	rootCmd.AddCommand(setCmd)
	rootCmd.AddCommand(deleteCmd)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
