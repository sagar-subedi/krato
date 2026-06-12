package config

import (
	"log/slog"
	"strings"

	flag "github.com/spf13/pflag"
	"github.com/spf13/viper"
)

// Config represents the strictly typed configuration representation of a Krato Node.
type Config struct {
	ID         string
	DBPath     string
	WALPath    string
	HTTPPort   string
	GRPCPort   string
	GossipPort string
	Advertise  string
	Seeds            []string
	GeminiKey        string
	ReplicationFactor int
}

// Load binds flags, maps viper environment limits, and returns a safely formatted Config.
func Load() (*Config, error) {
	if !flag.Parsed() {
		flag.String("id", "node1", "unique node ID")
		flag.String("db", "krato.db", "path to bbolt database")
		flag.String("wal", "krato.wal", "path to write-ahead log")
		flag.String("http", "8080", "HTTP API port")
		flag.String("grpc", "9090", "gRPC port")
		flag.String("gossip", "7070", "UDP Gossip port")
		flag.String("advertise", "localhost", "Address to advertise to cluster")
		flag.String("seeds", "", "comma separated explicit gossip seed addresses")
		flag.Int("rf", 3, "replication factor")
		flag.Parse()
	}

	viper.SetEnvPrefix("KRATO")
	viper.AutomaticEnv()
	viper.BindPFlags(flag.CommandLine)

	viper.SetConfigName("krato")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("/etc/krato/")
	if err := viper.ReadInConfig(); err != nil {
		slog.Debug("No config file located, utilizing explicit variables.")
	}

	seedsVal := viper.GetString("seeds")
	seedList := strings.Split(seedsVal, ",")
	validSeeds := make([]string, 0)
	for _, s := range seedList {
		s = strings.TrimSpace(s)
		if s != "" {
			validSeeds = append(validSeeds, s)
		}
	}

	return &Config{
		ID:         viper.GetString("id"),
		DBPath:     viper.GetString("db"),
		WALPath:    viper.GetString("wal"),
		HTTPPort:   viper.GetString("http"),
		GRPCPort:   viper.GetString("grpc"),
		GossipPort: viper.GetString("gossip"),
		Advertise:  viper.GetString("advertise"),
		Seeds:      validSeeds,
		GeminiKey:         viper.GetString("gemini_api_key"),
		ReplicationFactor: viper.GetInt("rf"),
	}, nil
}
