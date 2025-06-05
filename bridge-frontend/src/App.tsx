import React, { useState, useEffect } from "react";
import {
  Tabs,
  Card,
  Typography,
  Alert,
  Space,
  Button,
  Input,
  Divider,
  Tag,
  Steps,
  List,
  Row,
  Col,
  notification,
  Modal,
  Spin,
} from "antd";
import {
  InfoCircleOutlined,
  SwapOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined,
  SyncOutlined,
  MailOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WalletOutlined,
  ExportOutlined,
} from "@ant-design/icons";

// Viem imports
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  formatEther,
  parseEther,
  getContract,
} from "viem";
import { base } from "viem/chains";
import BridgeToSolanaTab from "./components/BridgeToSolana";
import BridgeToBaseTab from "./components/BridgeToBase";
import MigrateAncientTab from "./components/MigrateAncient";
import InstructionsTab from "./components/InstructionsTab";
import {
  ANCIENT_BASE_TOKEN,
  BASE_TOKEN,
  BRIDGE_BASE_CONTRACT_ADDRESS,
  BRIDGE_FEE,
  BRIDGE_VAULT_ABI,
  ERC20_ABI,
  type BridgeFormData,
  type TokenInfo,
  type WalletState,
} from "./constants";

const { Title, Paragraph, Text } = Typography;

const BridgeApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState("1");
  const [wallet, setWallet] = useState<WalletState>({
    isConnected: false,
    address: "",
    balance: "0",
  });
  const [tokenInfo, setTokenInfo] = useState<{
    base: TokenInfo | null;
    ancient: TokenInfo | null;
  }>({
    base: null,
    ancient: null,
  });
  const [loading, setLoading] = useState(false);
  const [bridgeInventory, setBridgeInventory] = useState("0");

  // Viem clients
  const publicClient = createPublicClient({
    chain: base,
    transport: http(
      "https://base-mainnet.g.alchemy.com/v2/EAF1m-3-59-iXzmNbA99cvWq9pFovfxu"
    ),
  });

  // Fetch token information
  const fetchTokenInfo = async () => {
    if (!wallet.isConnected) return;

    try {
      setLoading(true);

      // Base token contract
      const baseTokenContract = getContract({
        address: BASE_TOKEN as `0x${string}`,
        abi: ERC20_ABI,
        client: publicClient,
      });

      // Ancient token contract
      const ancientTokenContract = getContract({
        address: ANCIENT_BASE_TOKEN as `0x${string}`,
        abi: ERC20_ABI,
        client: publicClient,
      });

      // Fetch base token info
      const [baseName, baseSymbol, baseDecimals, baseBalance] =
        await Promise.all([
          baseTokenContract.read.name(),
          baseTokenContract.read.symbol(),
          baseTokenContract.read.decimals(),
          baseTokenContract.read.balanceOf([wallet.address as `0x${string}`]),
        ]);

      // Fetch ancient token info
      const [ancientName, ancientSymbol, ancientDecimals, ancientBalance] =
        await Promise.all([
          ancientTokenContract.read.name(),
          ancientTokenContract.read.symbol(),
          ancientTokenContract.read.decimals(),
          ancientTokenContract.read.balanceOf([
            wallet.address as `0x${string}`,
          ]),
        ]);

      // Fetch bridge inventory
      const bridgeContract = getContract({
        address: BRIDGE_BASE_CONTRACT_ADDRESS as `0x${string}`,
        abi: BRIDGE_VAULT_ABI,
        client: publicClient,
      });

      const inventory = await bridgeContract.read.getAvailableBridgeInventory();

      setTokenInfo({
        base: {
          name: baseName as string,
          symbol: baseSymbol as string,
          decimals: baseDecimals as number,
          balance: formatEther(baseBalance as bigint),
        },
        ancient: {
          name: ancientName as string,
          symbol: ancientSymbol as string,
          decimals: ancientDecimals as number,
          balance: formatEther(ancientBalance as bigint),
        },
      });

      setBridgeInventory(formatEther(inventory as bigint));
    } catch (error) {
      console.error("Failed to fetch token info:", error);
      notification.error({
        message: "Failed to Load Token Data",
        description: "Could not fetch token information from the blockchain",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (wallet.isConnected) {
      fetchTokenInfo();
    }
  }, [wallet.isConnected]);

  const tabItems = [
    {
      key: "1",
      label: (
        <Space>
          <InfoCircleOutlined />
          Instructions
        </Space>
      ),
      children: (
        <InstructionsTab
          wallet={wallet}
          tokenInfo={tokenInfo}
          setActiveTab={setActiveTab}
          setWallet={setWallet}
          bridgeInventory={bridgeInventory}
        />
      ),
    },
    {
      key: "2",
      label: (
        <Space>
          <ArrowRightOutlined />
          Bridge to Solana
        </Space>
      ),
      children: (
        <BridgeToSolanaTab
          tokenInfo={tokenInfo}
          fetchTokenInfo={fetchTokenInfo}
          wallet={wallet}
          setWallet={setWallet}
          bridgeInventory={bridgeInventory}
        />
      ),
    },
    {
      key: "3",
      label: (
        <Space>
          <ArrowLeftOutlined />
          Bridge to Base
        </Space>
      ),
      children: (
        <BridgeToBaseTab
          tokenInfo={tokenInfo}
          fetchTokenInfo={fetchTokenInfo}
          wallet={wallet}
          setWallet={setWallet}
          bridgeInventory={bridgeInventory}
        />
      ),
    },
    {
      key: "4",
      label: (
        <Space>
          <SyncOutlined />
          Migrate Ancient
        </Space>
      ),
      children: (
        <MigrateAncientTab
          tokenInfo={tokenInfo}
          fetchTokenInfo={fetchTokenInfo}
          wallet={wallet}
          setWallet={setWallet}
          setActiveTab={setActiveTab}
          bridgeInventory={bridgeInventory}
        />
      ),
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "24px",
        minWidth: "100vw",
        maxWidth: "100vw",
        overflowX: "hidden",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Card style={{ marginBottom: 24 }}>
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <Title level={1} style={{ margin: 0, color: "#1890ff" }}>
              OfficeX Bridge
            </Title>
            <Paragraph style={{ fontSize: 16, margin: "8px 0 0 0" }}>
              Cross-chain bridge between Base and Solana
            </Paragraph>
          </div>
        </Card>

        <Card>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            size="large"
            centered
          />
        </Card>

        <Card style={{ marginTop: 24, textAlign: "center" }}>
          <Space>
            <MailOutlined />
            <Text>Need help? Contact us at </Text>
            <a href="mailto:admin@officex.app">admin@officex.app</a>
          </Space>
        </Card>
      </div>

      {loading && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <Spin size="large" />
        </div>
      )}
    </div>
  );
};

export default BridgeApp;
