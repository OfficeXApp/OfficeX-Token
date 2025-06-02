import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card,
  Input,
  Button,
  message,
  Table,
  Tag,
  Space,
  Typography,
  Row,
  Col,
  Statistic,
  Spin,
  Tabs,
  Divider,
  Avatar,
  Layout,
  theme,
  Alert,
  Tooltip,
} from "antd";
import {
  WalletOutlined,
  SwapOutlined,
  HistoryOutlined,
  DashboardOutlined,
  SendOutlined,
  StopOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  LockOutlined,
  ExportOutlined,
} from "@ant-design/icons";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  formatEther,
  getContract,
  parseAbi,
  custom,
} from "viem";
import { base as mainnet } from "viem/chains";
import type { WalletClient, PublicClient } from "viem";

const { Title, Text, Paragraph } = Typography;
const { Content } = Layout;

// Extend Window interface for ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

// Contract ABI (simplified for the functions we need)
const BRIDGE_ABI = parseAbi([
  "function depositToBridge(uint256 tokenAmount, string calldata receivingWalletAddress) external",
  "function cancelBridge(uint256 depositId) external",

  // Use simple format - this should work
  "function deposits(uint256) external view returns (uint256, address, uint256, string, uint8, string)",

  "function depositCounter() external view returns (uint256)",
  "function totalNetDeposited() external view returns (uint256)",
  "function token() external view returns (address)",

  "event DepositMade(address indexed depositor, uint256 indexed depositId, uint256 amount, string receivingWalletAddress, uint8 status)",
  "event Cancel(address indexed depositor, uint256 indexed depositId, uint256 amount)",
  "event Lock(uint256 indexed depositId, uint256 amount, bool isLocked)",
  "event Burn(uint256 indexed depositId, uint256 amount, string txHash)",
]);

const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function name() external view returns (string)",
]);

// Contract addresses (you'll need to replace these with actual deployed addresses)
const BRIDGE_CONTRACT_ADDRESS =
  "0xB663A4Eb5D9D2dbfef59c5e101ec87Ec2BD3aEBf" as const;
const BASE_CONTRACT_ADDRESS =
  "0x4E9E4d2c145d5Df6D8eBCfBa947a6406F46d5BE0" as const;

const SOLANA_CONTRACT_ADDRESS =
  "mntp4nmZjsdRZzJ8h4JXPyq4xi5rfoc3pcJgfQhyxmy" as const;

// Types
interface DepositData {
  id: number;
  depositId: number;
  depositor: string;
  amount: string;
  receivingWalletAddress: string;
  status: number;
  txHash: string;
}

interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
}

interface DepositStatusConfig {
  label: string;
  color: "processing" | "error" | "warning" | "success";
  icon: React.ReactNode;
  tooltip: string;
}

const DepositStatus: Record<number, DepositStatusConfig> = {
  0: {
    label: "Awaiting",
    color: "processing",
    icon: <ClockCircleOutlined />,
    tooltip:
      "Awaiting up to 48 hours to bridge. You may cancel at any time to get your tokens back.",
  },
  1: {
    label: "Canceled",
    color: "error",
    icon: <CloseCircleOutlined />,
    tooltip:
      "Deposit was canceled. If you need to bridge again, please create a new deposit.",
  },
  2: {
    label: "Locked",
    color: "warning",
    icon: <LockOutlined />,
    tooltip:
      "Deposit is locked and processing. You cannot cancel or modify this deposit, just wait for it to complete and your tokens to be sent to you on Solana. This may take up to 48 hours.",
  },
  3: {
    label: "Completed",
    color: "success",
    icon: <CheckCircleOutlined />,
    tooltip: `Deposit completed. Your tokens have been sent to you on Solana. Check your receiving wallet. The Solana CA is ${SOLANA_CONTRACT_ADDRESS}`,
  },
};

function BridgeVaultFrontend() {
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [publicClient, setPublicClient] = useState<PublicClient | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [deposits, setDeposits] = useState<DepositData[]>([]);
  const [loading, setLoading] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo>({
    symbol: "TOKEN",
    name: "Loading...",
    decimals: 18,
    balance: "0",
  });
  const [totalDeposited, setTotalDeposited] = useState("0");
  const [activeTab, setActiveTab] = useState("0");
  const [isConnecting, setIsConnecting] = useState(false);

  // Form state
  const [depositAmount, setDepositAmount] = useState("");
  const [receivingAddress, setReceivingAddress] = useState("");

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  // Initialize clients
  useEffect(() => {
    const publicClient = createPublicClient({
      chain: mainnet, // Use Base mainnet
      transport: http(
        "https://base-mainnet.g.alchemy.com/v2/EAF1m-3-59-iXzmNbA99cvWq9pFovfxu"
      ),
    }) as PublicClient;
    setPublicClient(publicClient);
  }, []);

  // Connect wallet
  const connectWallet = useCallback(async () => {
    try {
      setIsConnecting(true);
      if (typeof window.ethereum !== "undefined") {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });

        const walletClient = createWalletClient({
          chain: mainnet,
          transport: custom(window.ethereum),
        });

        setWalletClient(walletClient);
        setAccount(accounts[0]);
        message.success("Wallet connected successfully!");
      } else {
        message.error("Please install MetaMask or another Ethereum wallet");
      }
    } catch (error) {
      message.error("Failed to connect wallet");
      console.error(error);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Load token info and user data
  useEffect(() => {
    if (publicClient && account) {
      loadTokenInfo();
      loadUserDeposits();
      loadContractStats();
    }
  }, [publicClient, account]);

  const loadTokenInfo = useCallback(async () => {
    if (!publicClient || !account) return;

    try {
      setLoading(true);
      const tokenContract = getContract({
        address: BASE_CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        client: publicClient,
      });

      const [balance, symbol, name, decimals] = await Promise.all([
        tokenContract.read.balanceOf([account as `0x${string}`]),
        tokenContract.read.symbol(),
        tokenContract.read.name(),
        tokenContract.read.decimals(),
      ]);

      setTokenInfo({
        balance: formatEther(balance),
        symbol,
        name,
        decimals,
      });
    } catch (error) {
      console.error("Error loading token info:", error);
      message.error("Failed to load token information");
    } finally {
      setLoading(false);
    }
  }, [publicClient, account]);

  const loadContractStats = useCallback(async () => {
    if (!publicClient) return;

    try {
      const bridgeContract = getContract({
        address: BRIDGE_CONTRACT_ADDRESS,
        abi: BRIDGE_ABI,
        client: publicClient,
      });

      const totalDeposited = await bridgeContract.read.totalNetDeposited();
      setTotalDeposited(formatEther(totalDeposited));
    } catch (error) {
      console.error("Error loading contract stats:", error);
    }
  }, [publicClient]);

  const loadUserDeposits = useCallback(async () => {
    if (!publicClient || !account) return;

    try {
      setLoading(true);
      const bridgeContract = getContract({
        address: BRIDGE_CONTRACT_ADDRESS,
        abi: BRIDGE_ABI,
        client: publicClient,
      });

      const depositCounter = await bridgeContract.read.depositCounter();
      const userDeposits: DepositData[] = [];

      // Load all deposits and filter for current user
      for (let i = 0; i < Number(depositCounter); i++) {
        try {
          const [
            depositId,
            depositor,
            amount,
            receivingWalletAddress,
            status,
            txFinal,
          ] = await publicClient.readContract({
            address: BRIDGE_CONTRACT_ADDRESS,
            abi: BRIDGE_ABI,
            functionName: "deposits",
            args: [BigInt(i)],
          });

          if (depositor.toLowerCase() === account.toLowerCase()) {
            userDeposits.push({
              id: i,
              depositId: Number(depositId),
              depositor,
              amount: formatEther(amount),
              receivingWalletAddress,
              status: Number(status),
              txHash: txFinal || "",
            });
          }
        } catch (error) {
          console.error(`Error loading deposit ${i}:`, error);
          continue;
        }
      }

      setDeposits(userDeposits);
    } catch (error) {
      console.error("Error loading deposits:", error);
      message.error("Failed to load deposits");
    } finally {
      setLoading(false);
    }
  }, [publicClient, account]);

  const validateDepositForm = useCallback(() => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      message.error("Please enter a valid amount greater than 0");
      return false;
    }
    if (parseFloat(depositAmount) > parseFloat(tokenInfo.balance)) {
      message.error("Amount exceeds your balance");
      return false;
    }
    if (!receivingAddress || receivingAddress.length < 10) {
      message.error("Please enter a valid receiving wallet address");
      return false;
    }
    return true;
  }, [depositAmount, tokenInfo.balance, receivingAddress]);

  const handleDeposit = useCallback(async () => {
    if (!validateDepositForm() || !walletClient || !account) return;

    try {
      setLoading(true);

      const amount = parseEther(depositAmount);

      // First approve the bridge contract to spend tokens
      const tokenContract = getContract({
        address: BASE_CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        client: walletClient,
      });

      const allowance = await tokenContract.read.allowance([
        account as `0x${string}`,
        BRIDGE_CONTRACT_ADDRESS,
      ]);

      if (allowance < amount) {
        message.info("Approving token spending...");
        await tokenContract.write.approve([BRIDGE_CONTRACT_ADDRESS, amount], {
          account: account as `0x${string}`,
          chain: mainnet,
        });
        message.info("Approval transaction sent, waiting for confirmation...");
      }

      // Then make the deposit
      const bridgeContract = getContract({
        address: BRIDGE_CONTRACT_ADDRESS,
        abi: BRIDGE_ABI,
        client: walletClient,
      });

      message.info("Creating deposit...");
      await bridgeContract.write.depositToBridge([amount, receivingAddress], {
        account: account as `0x${string}`,
        chain: mainnet,
      });

      message.success("Deposit created successfully!");
      setDepositAmount("");
      setReceivingAddress("");

      // Switch to deposits tab and reload data
      setActiveTab("2");
      setTimeout(() => {
        loadUserDeposits();
        loadTokenInfo();
        loadContractStats();
      }, 2000);
    } catch (error) {
      console.error("Deposit error:", error);
      message.error("Failed to create deposit");
    } finally {
      setLoading(false);
    }
  }, [
    validateDepositForm,
    walletClient,
    account,
    depositAmount,
    receivingAddress,
    loadUserDeposits,
    loadTokenInfo,
    loadContractStats,
  ]);

  const handleCancel = useCallback(
    async (depositId: number) => {
      if (!walletClient || !account) {
        message.error("Wallet not connected");
        return;
      }

      try {
        setLoading(true);
        console.log("Attempting to cancel deposit:", depositId);

        const bridgeContract = getContract({
          address: BRIDGE_CONTRACT_ADDRESS,
          abi: BRIDGE_ABI,
          client: walletClient,
        });

        message.info("Please confirm the cancellation in your wallet...");

        const hash = await bridgeContract.write.cancelBridge(
          [BigInt(depositId)],
          {
            account: account as `0x${string}`,
            chain: mainnet,
          }
        );

        console.log("Transaction hash:", hash);
        message.success("Cancel transaction submitted! Hash: " + hash);

        setTimeout(() => {
          loadUserDeposits();
          loadTokenInfo();
          loadContractStats();
        }, 5000);
      } catch (error: any) {
        console.error("Cancel error:", error);

        if (error?.message?.includes("User rejected")) {
          message.error("Transaction was rejected");
        } else if (error?.message?.includes("insufficient funds")) {
          message.error("Insufficient gas funds");
        } else if (error?.message?.includes("execution reverted")) {
          message.error(
            "Transaction failed: " +
              (error.reason || "Contract execution reverted")
          );
        } else {
          message.error(
            "Failed to cancel deposit: " + (error?.message || "Unknown error")
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [walletClient, account, loadUserDeposits, loadTokenInfo, loadContractStats]
  );

  // Memoize the columns to prevent recreation on every render
  const columns = useMemo(
    () => [
      {
        title: "ID",
        dataIndex: "id",
        key: "id",
        width: 60,
        render: (id: number) => <Text strong>#{id}</Text>,
      },
      {
        title: "Amount",
        dataIndex: "amount",
        key: "amount",
        render: (amount: string) => (
          <Space>
            <Text strong style={{ color: "#1890ff" }}>
              {parseFloat(amount).toFixed(4)}
            </Text>
            <Text type="secondary">{tokenInfo.symbol}</Text>
          </Space>
        ),
      },
      {
        title: "Receiving Address",
        dataIndex: "receivingWalletAddress",
        key: "receivingWalletAddress",
        ellipsis: true,
        render: (address: string) => (
          <Text code style={{ fontSize: "12px" }}>
            <a href={`https://solscan.io/account/${address}`} target="_blank">
              {address.slice(0, 8)}...{address.slice(-6)}
            </a>
          </Text>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (status: number) => {
          const statusConfig = DepositStatus[status];
          return (
            <Tooltip title={statusConfig?.tooltip}>
              <Tag color={statusConfig?.color} icon={statusConfig?.icon}>
                {statusConfig?.label}
              </Tag>
            </Tooltip>
          );
        },
      },
      {
        title: "Actions",
        key: "actions",
        width: 200,
        render: (_: any, record: DepositData) => (
          <Space>
            {record.status === 0 ? (
              <Button
                size="small"
                danger
                icon={<StopOutlined />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("Cancel button clicked for deposit:", record.id);
                  handleCancel(record.id);
                }}
                disabled={loading}
              >
                Cancel
              </Button>
            ) : record.status === 3 ? (
              <Button
                size="small"
                type="primary"
                icon={<ExportOutlined />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(
                    `https://solscan.io/tx/${record.txHash}`,
                    "_blank"
                  );
                }}
              >
                View Tx
              </Button>
            ) : null}
          </Space>
        ),
      },
    ],
    [tokenInfo.symbol, loading, handleCancel]
  );

  // Memoize input change handlers to prevent recreation
  const handleDepositAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDepositAmount(e.target.value);
    },
    []
  );

  const handleReceivingAddressChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setReceivingAddress(e.target.value);
    },
    []
  );

  const handleMaxClick = useCallback(() => {
    setDepositAmount(tokenInfo.balance);
  }, [tokenInfo.balance]);

  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key);
  }, []);

  // Dashboard Tab Content
  const DashboardContent = useMemo(
    () => (
      <div style={{ padding: "0 8px" }}>
        <Row gutter={[24, 24]}>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="Your Balance"
                value={parseFloat(tokenInfo.balance)}
                suffix={tokenInfo.symbol}
                precision={4}
                prefix={<WalletOutlined style={{ color: "#52c41a" }} />}
                valueStyle={{ color: "#52c41a" }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="Total Bridge Volume"
                value={parseFloat(totalDeposited)}
                suffix={tokenInfo.symbol}
                precision={4}
                prefix={<SwapOutlined style={{ color: "#1890ff" }} />}
                valueStyle={{ color: "#1890ff" }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="Your Deposits"
                value={deposits.length}
                suffix="transactions"
                prefix={<HistoryOutlined style={{ color: "#722ed1" }} />}
                valueStyle={{ color: "#722ed1" }}
              />
            </Card>
          </Col>
        </Row>

        <Divider />

        {/* Token Information Card */}
        <Row gutter={[24, 24]} style={{ marginBottom: "24px" }}>
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space>
                  <Avatar
                    style={{ backgroundColor: "#52c41a" }}
                    icon={<WalletOutlined />}
                  />
                  Token Information
                </Space>
              }
            >
              <div style={{ padding: "8px 0" }}>
                <Row gutter={[16, 16]}>
                  <Col span={24}>
                    <Text strong style={{ fontSize: "16px" }}>
                      {tokenInfo.name}
                    </Text>
                    <br />
                    <Text type="secondary">Symbol: {tokenInfo.symbol}</Text>
                    <br />
                    <Text
                      type="secondary"
                      style={{ fontSize: "12px", wordBreak: "break-all" }}
                    >
                      Contract:{" "}
                      <a
                        href={`https://basescan.org/address/${BASE_CONTRACT_ADDRESS}`}
                        target="_blank"
                      >
                        {BASE_CONTRACT_ADDRESS}
                      </a>
                    </Text>
                  </Col>
                  <Col span={24}>
                    <Text strong>Your Balance: </Text>
                    <Text style={{ color: "#52c41a", fontSize: "16px" }}>
                      {parseFloat(tokenInfo.balance).toFixed(4)}{" "}
                      {tokenInfo.symbol}
                    </Text>
                  </Col>
                </Row>
                <Row>
                  <Col span={24}>
                    <Text strong>Bridged Solana CA: </Text>
                    <Text style={{ color: "blue", fontSize: "16px" }}>
                      <a
                        href={`https://solscan.io/address/${SOLANA_CONTRACT_ADDRESS}`}
                        target="_blank"
                      >
                        {SOLANA_CONTRACT_ADDRESS}
                      </a>
                    </Text>
                  </Col>
                </Row>
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card
              title={
                <Space>
                  <Avatar
                    style={{ backgroundColor: "#1890ff" }}
                    icon={<SendOutlined />}
                  />
                  Recent Activity
                </Space>
              }
            >
              {deposits.length > 0 ? (
                <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                  {deposits.slice(0, 3).map((deposit) => {
                    const statusConfig = DepositStatus[deposit.status];
                    return (
                      <div
                        key={deposit.id}
                        style={{
                          padding: "12px 0",
                          borderBottom:
                            deposits.indexOf(deposit) < 2
                              ? "1px solid #f0f0f0"
                              : "none",
                        }}
                      >
                        <Row justify="space-between" align="middle">
                          <Col>
                            <Text strong>Deposit #{deposit.id}</Text>
                            <br />
                            <Text type="secondary" style={{ fontSize: "12px" }}>
                              {parseFloat(deposit.amount).toFixed(4)}{" "}
                              {tokenInfo.symbol}
                            </Text>
                          </Col>
                          <Col>
                            <Tag
                              color={statusConfig?.color}
                              icon={statusConfig?.icon}
                            >
                              {statusConfig?.label}
                            </Tag>
                          </Col>
                        </Row>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <Text type="secondary">No deposits yet</Text>
                  <br />
                  <Button type="link" onClick={() => setActiveTab("1")}>
                    Create your first deposit
                  </Button>
                </div>
              )}
            </Card>
          </Col>
        </Row>

        <Row gutter={[24, 24]}>
          <Col xs={24}>
            <Card
              title={
                <Space>
                  <Avatar
                    style={{ backgroundColor: "#722ed1" }}
                    icon={<SwapOutlined />}
                  />
                  How Bridge Works
                </Space>
              }
            >
              <div style={{ padding: "8px 0" }}>
                <Row gutter={[24, 16]}>
                  <Col xs={24} md={8}>
                    <div style={{ textAlign: "center" }}>
                      <Avatar
                        size={48}
                        style={{
                          backgroundColor: "#52c41a",
                          marginBottom: "12px",
                        }}
                      >
                        <SendOutlined />
                      </Avatar>
                      <br />
                      <Text strong>1. Create Deposit</Text>
                      <br />
                      <Text type="secondary">
                        Lock your Base tokens in the bridge vault
                      </Text>
                    </div>
                  </Col>
                  <Col xs={24} md={8}>
                    <div style={{ textAlign: "center" }}>
                      <Avatar
                        size={48}
                        style={{
                          backgroundColor: "#fa8c16",
                          marginBottom: "12px",
                        }}
                      >
                        <LockOutlined />
                      </Avatar>
                      <br />
                      <Text strong>2. Processing</Text>
                      <br />
                      <Text type="secondary">
                        Your deposit is verified and locked
                      </Text>
                    </div>
                  </Col>
                  <Col xs={24} md={8}>
                    <div style={{ textAlign: "center" }}>
                      <Avatar
                        size={48}
                        style={{
                          backgroundColor: "#1890ff",
                          marginBottom: "12px",
                        }}
                      >
                        <CheckCircleOutlined />
                      </Avatar>
                      <br />
                      <Text strong>3. Completion</Text>
                      <br />
                      <Text type="secondary">
                        Tokens are released on Solana within 24 hours
                      </Text>
                    </div>
                  </Col>
                </Row>

                <div style={{ textAlign: "center", marginTop: "24px" }}>
                  <Button
                    type="primary"
                    size="large"
                    icon={<SendOutlined />}
                    onClick={() => setActiveTab("1")}
                  >
                    Start Bridging
                  </Button>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    ),
    [tokenInfo, totalDeposited, deposits]
  );

  // Bridge Tab Content
  const BridgeContent = useMemo(
    () => (
      <Row justify="center">
        <Col xs={24} sm={20} md={16} lg={12} xl={10}>
          <Card
            title={
              <Space>
                <Avatar
                  style={{ backgroundColor: "#1890ff" }}
                  icon={<SwapOutlined />}
                />
                Create Bridge Deposit
                <a
                  href={`https://basescan.org/address/${BRIDGE_CONTRACT_ADDRESS}#code`}
                  target="_blank"
                  style={{ marginLeft: "8px", fontSize: "0.8rem" }}
                >
                  View Bridge Contract
                </a>
              </Space>
            }
            style={{ marginTop: "20px" }}
          >
            {parseFloat(tokenInfo.balance) === 0 && (
              <Alert
                message="No tokens available"
                description={`You don't have any ${tokenInfo.symbol} tokens to bridge. Please acquire some tokens first.`}
                type="warning"
                showIcon
                style={{ marginBottom: "24px" }}
              />
            )}

            <div style={{ padding: "8px 0" }}>
              <div style={{ marginBottom: "24px" }}>
                <Text strong style={{ fontSize: "16px" }}>
                  Amount
                </Text>
                <Input
                  size="large"
                  placeholder="0.0"
                  suffix={
                    <Space>
                      <Text type="secondary">{tokenInfo.symbol}</Text>
                      <Button
                        type="link"
                        size="small"
                        onClick={handleMaxClick}
                        disabled={parseFloat(tokenInfo.balance) === 0}
                      >
                        MAX
                      </Button>
                    </Space>
                  }
                  type="number"
                  step="0.000001"
                  value={depositAmount}
                  onChange={handleDepositAmountChange}
                  disabled={loading}
                  style={{ marginTop: "8px" }}
                  onFocus={(e) => e.target.select()}
                />
                <div style={{ marginTop: "4px" }}>
                  <Text type="secondary" style={{ fontSize: "12px" }}>
                    Available: {parseFloat(tokenInfo.balance).toFixed(4)}{" "}
                    {tokenInfo.symbol}
                  </Text>
                </div>
              </div>

              <div style={{ marginBottom: "24px" }}>
                <Text strong style={{ fontSize: "16px" }}>
                  Solana Destination Address
                </Text>
                <Input
                  size="large"
                  placeholder="Enter wallet address on Solana mainnet"
                  value={receivingAddress}
                  onChange={handleReceivingAddressChange}
                  disabled={loading}
                  style={{ marginTop: "8px" }}
                />
                <Text type="secondary" style={{ fontSize: "12px" }}>
                  Bridging may take up to 48 hours
                </Text>
              </div>

              <Button
                type="primary"
                size="large"
                onClick={handleDeposit}
                loading={loading}
                block
                icon={<SendOutlined />}
                disabled={parseFloat(tokenInfo.balance) === 0}
                style={{
                  height: "48px",
                  fontSize: "16px",
                  fontWeight: "bold",
                }}
              >
                Create Deposit
              </Button>
            </div>
          </Card>
        </Col>
      </Row>
    ),
    [
      tokenInfo,
      depositAmount,
      receivingAddress,
      loading,
      handleDepositAmountChange,
      handleReceivingAddressChange,
      handleMaxClick,
      handleDeposit,
    ]
  );

  // Deposits Tab Content
  const DepositsContent = useMemo(
    () => (
      <div style={{ padding: "0 8px" }}>
        <Card
          title={
            <Space>
              <Avatar
                style={{ backgroundColor: "#722ed1" }}
                icon={<HistoryOutlined />}
              />
              Your Deposits
            </Space>
          }
          extra={
            <Button
              icon={<ReloadOutlined />}
              onClick={loadUserDeposits}
              loading={loading}
            >
              Refresh
            </Button>
          }
        >
          <Spin spinning={loading}>
            <Table
              columns={columns}
              dataSource={deposits}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: false,
                showQuickJumper: true,
              }}
              locale={{
                emptyText: (
                  <div style={{ padding: "40px 0" }}>
                    <Text type="secondary">No deposits found</Text>
                    <br />
                    <Button type="link" onClick={() => setActiveTab("1")}>
                      Create your first deposit
                    </Button>
                  </div>
                ),
              }}
            />
          </Spin>
        </Card>
      </div>
    ),
    [columns, deposits, loading, loadUserDeposits]
  );

  // Memoize tab items to prevent recreation
  const tabItems = useMemo(
    () => [
      {
        key: "0",
        label: (
          <Space>
            <DashboardOutlined />
            Dashboard
          </Space>
        ),
        children: DashboardContent,
      },
      {
        key: "1",
        label: (
          <Space>
            <SwapOutlined />
            Bridge
          </Space>
        ),
        children: BridgeContent,
      },
      {
        key: "2",
        label: (
          <Space>
            <HistoryOutlined />
            My Deposits
          </Space>
        ),
        children: DepositsContent,
      },
    ],
    [DashboardContent, BridgeContent, DepositsContent]
  );

  if (!account) {
    return (
      <Layout
        style={{
          minHeight: "100vh",
          minWidth: "100vw",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        }}
      >
        <Content
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "50px",
          }}
        >
          <Card
            style={{
              maxWidth: 480,
              width: "100%",
              textAlign: "center",
              borderRadius: borderRadiusLG,
              boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ padding: "24px 0" }}>
              <Avatar
                size={64}
                style={{
                  backgroundColor: "#1890ff",
                  marginBottom: "24px",
                }}
                icon={<SwapOutlined />}
              />
              <Title level={2} style={{ margin: "0 0 8px 0" }}>
                $OFFICEX Bridge
              </Title>
              <Paragraph
                type="secondary"
                style={{ fontSize: "16px", marginBottom: "32px" }}
              >
                Securely & transparently bridge your $OFFICEX tokens from Base
                to Solana
              </Paragraph>
              <Button
                type="primary"
                size="large"
                icon={<WalletOutlined />}
                onClick={connectWallet}
                loading={isConnecting}
                style={{
                  height: "48px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  minWidth: "200px",
                }}
              >
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </Button>
            </div>
          </Card>
        </Content>
      </Layout>
    );
  }

  return (
    <Layout
      style={{
        minHeight: "100vh",
        minWidth: "100vw",
        background: colorBgContainer,
      }}
    >
      <Content style={{ padding: "24px", maxWidth: "none" }}>
        <div style={{ maxWidth: "100%", margin: "0 auto" }}>
          {/* Header */}
          <div
            style={{
              marginBottom: "32px",
              padding: "24px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: borderRadiusLG,
              color: "white",
            }}
          >
            <Row justify="space-between" align="middle">
              <Col>
                <Title level={2} style={{ color: "white", margin: 0 }}>
                  $OFFICEX | Bridge Vault
                </Title>
                <Text
                  style={{ color: "rgba(255,255,255,0.8)", fontSize: "14px" }}
                >
                  Connected: {account.slice(0, 6)}...{account.slice(-4)}
                </Text>
              </Col>
              <Col>
                <Avatar
                  size={48}
                  style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
                >
                  <WalletOutlined style={{ fontSize: "24px" }} />
                </Avatar>
              </Col>
            </Row>
          </div>

          {/* Main Content */}
          <div
            style={{
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
              padding: "24px",
              width: "100%",
            }}
          >
            <Tabs
              activeKey={activeTab}
              onChange={handleTabChange}
              size="large"
              items={tabItems}
              style={{ width: "100%" }}
            />
          </div>
        </div>
      </Content>
    </Layout>
  );
}

export default BridgeVaultFrontend;
