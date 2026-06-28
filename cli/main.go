package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/user"
	"path/filepath"
	"strings"
	"time"
)

const (
	version    = "2.0.0"
	apiBaseURL = "https://api.metamesh-uga.dev"
	configFile = ".metamesh/config.json"
)

// Config holds the CLI configuration. Authentication uses a real agent
// identity (agent_id + agent_key) issued by POST /v1/agent/register.
type Config struct {
	AgentID  string `json:"agent_id"`
	AgentKey string `json:"agent_key"`
	Name     string `json:"name,omitempty"`
	LastUsed string `json:"last_used"`
}

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	switch os.Args[1] {
	case "connect", "register":
		connect()
	case "call":
		call()
	case "list":
		list()
	case "topup":
		topup()
	case "wallet", "usage":
		wallet()
	case "config":
		config()
	case "version", "-v", "--version":
		fmt.Printf("metamesh version %s\n", version)
	case "help", "-h", "--help":
		printUsage()
	default:
		fmt.Printf("Unknown command: %s\n", os.Args[1])
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println(`MetaMesh-UGA CLI - The MCP Operating System

Usage:
  metamesh <command> [options]

Commands:
  connect              Register a real agent (or import an existing one) and save credentials
  call <tool>          Call an MCP tool (free monthly quota, then prepaid balance is debited)
  list                 List available MCP tools (free)
  topup <amount_usd>   Create a real Stripe Checkout link to add prepaid credit
  wallet               Show real balance, spend and free-quota usage
  config               Show local configuration
  version              Show version
  help                 Show this help message

Examples:
  metamesh connect
  metamesh call example.echo --message "hello"
  metamesh list --category demo
  metamesh topup 25
  metamesh wallet

Pricing: discovery is free; every agent gets a free monthly call quota, then
pay-as-you-go ($0.001/call) from prepaid Stripe credit. Top up with 'metamesh topup'.

For more information, visit: https://metamesh-uga.dev`)
}

// connect registers a real agent against POST /v1/agent/register, or imports
// existing credentials. No mock keys are ever generated.
func connect() {
	if cfg, err := loadConfig(); err == nil && cfg.AgentID != "" && cfg.AgentKey != "" {
		fmt.Printf("✅ Already connected as agent %s\n", cfg.AgentID)
		fmt.Println("   Run 'metamesh wallet' to see your balance or 'metamesh config' for details.")
		return
	}

	reader := bufio.NewReader(os.Stdin)
	fmt.Print("Paste an existing Agent ID (or press Enter to register a new agent): ")
	existingID, _ := reader.ReadString('\n')
	existingID = strings.TrimSpace(existingID)

	var cfg *Config
	if existingID != "" {
		fmt.Print("Paste the matching Agent Key: ")
		key, _ := reader.ReadString('\n')
		key = strings.TrimSpace(key)
		if key == "" {
			fmt.Println("❌ An Agent Key is required to import an existing agent.")
			os.Exit(1)
		}
		cfg = &Config{AgentID: existingID, AgentKey: key}
		bal, err := fetchWallet(cfg)
		if err != nil {
			fmt.Printf("❌ Could not verify credentials: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("✅ Imported agent %s (balance $%.4f)\n", cfg.AgentID, bal.BalanceUSD)
	} else {
		fmt.Print("Agent name [my-agent]: ")
		name, _ := reader.ReadString('\n')
		name = strings.TrimSpace(name)
		if name == "" {
			name = "my-agent"
		}
		fmt.Println("🆕 Registering a new agent...")
		reg, err := registerAgent(name)
		if err != nil {
			fmt.Printf("❌ Registration failed: %v\n", err)
			os.Exit(1)
		}
		cfg = &Config{AgentID: reg.AgentID, AgentKey: reg.APIKey, Name: name}
		fmt.Printf("✅ Agent registered: %s\n", reg.AgentID)
		fmt.Printf("   Agent Key (shown once): %s\n", reg.APIKey)
		fmt.Println("   Store the key securely — it cannot be recovered.")
	}

	cfg.LastUsed = time.Now().Format(time.RFC3339)
	if err := saveConfig(cfg); err != nil {
		fmt.Printf("⚠️  Connected but failed to save config: %v\n", err)
		return
	}

	fmt.Printf("\n💡 You have a free monthly quota of tool calls. After that, top up to keep going:\n")
	fmt.Printf("   metamesh topup 10\n")
}

func call() {
	if len(os.Args) < 3 {
		fmt.Println("❌ Usage: metamesh call <tool> [--key value ...]")
		fmt.Println("   Example: metamesh call example.echo --message \"hello\"")
		os.Exit(1)
	}

	toolName := os.Args[2]

	params := make(map[string]interface{})
	for i := 3; i < len(os.Args); i++ {
		arg := os.Args[i]
		if strings.HasPrefix(arg, "--") {
			key := strings.TrimPrefix(arg, "--")
			if i+1 < len(os.Args) && !strings.HasPrefix(os.Args[i+1], "--") {
				params[key] = os.Args[i+1]
				i++
			} else {
				params[key] = true
			}
		}
	}

	cfg, err := loadConfig()
	if err != nil {
		fmt.Println("❌ Not connected. Run 'metamesh connect' first.")
		os.Exit(1)
	}

	fmt.Printf("🔄 Calling tool: %s\n", toolName)

	result, status, err := callTool(cfg, toolName, params)
	if err != nil {
		fmt.Printf("❌ Error: %v\n", err)
		os.Exit(1)
	}

	if status == http.StatusPaymentRequired {
		fmt.Println("💳 Payment required — your free quota is used up.")
		output, _ := json.MarshalIndent(result, "", "  ")
		fmt.Println(string(output))
		fmt.Println("\n👉 Add prepaid credit with: metamesh topup 10")
		os.Exit(2)
	}

	output, _ := json.MarshalIndent(result, "", "  ")
	fmt.Println("✅ Result:")
	fmt.Println(string(output))
}

func list() {
	category := ""
	for i := 2; i < len(os.Args); i++ {
		if os.Args[i] == "--category" && i+1 < len(os.Args) {
			category = os.Args[i+1]
			break
		}
	}

	fmt.Println("🔄 Fetching tools...")

	tools, err := listTools(category)
	if err != nil {
		fmt.Printf("❌ Error: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("📦 Available Tools (%d shown):\n\n", len(tools))
	for _, tool := range tools {
		fmt.Printf("  • %s\n", tool["name"])
		if desc, ok := tool["description"].(string); ok && desc != "" {
			fmt.Printf("    %s\n", desc)
		}
		if cat, ok := tool["category"].(string); ok && cat != "" {
			fmt.Printf("    Category: %s\n", cat)
		}
		fmt.Println()
	}
}

// topup creates a real Stripe Checkout session for prepaid credit.
func topup() {
	if len(os.Args) < 3 {
		fmt.Println("❌ Usage: metamesh topup <amount_usd>")
		fmt.Println("   Example: metamesh topup 25")
		os.Exit(1)
	}

	cfg, err := loadConfig()
	if err != nil {
		fmt.Println("❌ Not connected. Run 'metamesh connect' first.")
		os.Exit(1)
	}

	amount := os.Args[2]
	fmt.Printf("💳 Creating Stripe Checkout for $%s ...\n", amount)

	checkoutURL, err := createTopup(cfg, amount)
	if err != nil {
		fmt.Printf("❌ Top-up failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("✅ Open this URL to pay (real Stripe Checkout):")
	fmt.Printf("   %s\n", checkoutURL)
	fmt.Println("\nYour balance is credited automatically once payment completes.")
}

func wallet() {
	cfg, err := loadConfig()
	if err != nil {
		fmt.Println("❌ Not connected. Run 'metamesh connect' first.")
		os.Exit(1)
	}

	w, err := fetchWallet(cfg)
	if err != nil {
		fmt.Printf("❌ Error: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("📊 Wallet & Usage:")
	fmt.Printf("  Agent ID:        %s\n", w.AgentID)
	if w.Name != "" {
		fmt.Printf("  Name:            %s\n", w.Name)
	}
	fmt.Printf("  Plan:            %s\n", w.Plan)
	fmt.Printf("  Balance:         $%.4f\n", w.BalanceUSD)
	fmt.Printf("  Total spent:     $%.4f\n", w.TotalSpentUSD)
	if w.BalanceUSD <= 0 {
		fmt.Println("\n  ⚠️  Balance is empty. After your free monthly quota, calls require credit.")
		fmt.Println("     Add credit with: metamesh topup 10")
	}
}

func config() {
	cfg, err := loadConfig()
	if err != nil {
		fmt.Println("❌ Not connected. Run 'metamesh connect' first.")
		os.Exit(1)
	}

	fmt.Println("⚙️  Configuration:")
	fmt.Printf("  Agent ID:    %s\n", cfg.AgentID)
	fmt.Printf("  Agent Key:   %s…\n", safePrefix(cfg.AgentKey, 8))
	if cfg.Name != "" {
		fmt.Printf("  Name:        %s\n", cfg.Name)
	}
	fmt.Printf("  Config file: %s\n", getConfigPath())
}

// ---- HTTP client helpers (all hit the real gateway) ----

type registerResult struct {
	AgentID string `json:"agent_id"`
	APIKey  string `json:"api_key"`
}

type walletInfo struct {
	AgentID       string  `json:"agent_id"`
	Name          string  `json:"name"`
	Plan          string  `json:"plan"`
	BalanceUSD    float64 `json:"balance_usd"`
	TotalSpentUSD float64 `json:"total_spent_usd"`
}

func httpClient() *http.Client { return &http.Client{Timeout: 30 * time.Second} }

func authHeaders(req *http.Request, cfg *Config) {
	req.Header.Set("X-Agent-Id", cfg.AgentID)
	req.Header.Set("X-Agent-Key", cfg.AgentKey)
}

func registerAgent(name string) (*registerResult, error) {
	payload, _ := json.Marshal(map[string]string{"name": name})
	req, err := http.NewRequest("POST", apiBaseURL+"/v1/agent/register", strings.NewReader(string(payload)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := httpClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 && resp.StatusCode != 201 {
		return nil, fmt.Errorf("register failed (%d): %s", resp.StatusCode, string(body))
	}

	var r registerResult
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, err
	}
	if r.AgentID == "" || r.APIKey == "" {
		return nil, fmt.Errorf("unexpected response: %s", string(body))
	}
	return &r, nil
}

func callTool(cfg *Config, toolName string, params map[string]interface{}) (map[string]interface{}, int, error) {
	payload, _ := json.Marshal(map[string]interface{}{"tool": toolName, "params": params})
	req, err := http.NewRequest("POST", apiBaseURL+"/v1/call", strings.NewReader(string(payload)))
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	authHeaders(req, cfg)

	resp, err := httpClient().Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var result map[string]interface{}
	_ = json.Unmarshal(body, &result)

	// 402 payment required is returned to the caller (not an error) so it can
	// guide the user to top up.
	if resp.StatusCode != 200 && resp.StatusCode != 402 {
		if result != nil {
			if errMsg, ok := result["error"].(string); ok {
				return nil, resp.StatusCode, fmt.Errorf("%s", errMsg)
			}
		}
		return nil, resp.StatusCode, fmt.Errorf("API error: %d", resp.StatusCode)
	}
	return result, resp.StatusCode, nil
}

func listTools(category string) ([]map[string]interface{}, error) {
	url := apiBaseURL + "/v1/tools?limit=50"
	if category != "" {
		url += "&category=" + category
	}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := httpClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var result struct {
		Tools []map[string]interface{} `json:"tools"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	return result.Tools, nil
}

func createTopup(cfg *Config, amountUsd string) (string, error) {
	payload := fmt.Sprintf(`{"amount_usd": %s}`, amountUsd)
	req, err := http.NewRequest("POST", apiBaseURL+"/v1/agent/topup", strings.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	authHeaders(req, cfg)

	resp, err := httpClient().Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var result map[string]interface{}
	_ = json.Unmarshal(body, &result)

	if resp.StatusCode != 200 {
		if result != nil {
			if errMsg, ok := result["error"].(string); ok {
				return "", fmt.Errorf("%s", errMsg)
			}
		}
		return "", fmt.Errorf("API error: %d: %s", resp.StatusCode, string(body))
	}

	if url, ok := result["checkout_url"].(string); ok && url != "" {
		return url, nil
	}
	return "", fmt.Errorf("no checkout_url in response: %s", string(body))
}

func fetchWallet(cfg *Config) (*walletInfo, error) {
	req, err := http.NewRequest("GET", apiBaseURL+"/v1/agent/wallet", nil)
	if err != nil {
		return nil, err
	}
	authHeaders(req, cfg)

	resp, err := httpClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("wallet error (%d): %s", resp.StatusCode, string(body))
	}

	var w walletInfo
	if err := json.Unmarshal(body, &w); err != nil {
		return nil, err
	}
	return &w, nil
}

// ---- config persistence ----

func getConfigPath() string {
	usr, err := user.Current()
	if err != nil {
		return configFile
	}
	return filepath.Join(usr.HomeDir, configFile)
}

func loadConfig() (*Config, error) {
	data, err := os.ReadFile(getConfigPath())
	if err != nil {
		return nil, err
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func saveConfig(cfg *Config) error {
	path := getConfigPath()
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0600)
}

func safePrefix(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
