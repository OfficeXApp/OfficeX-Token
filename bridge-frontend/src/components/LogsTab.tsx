import {
  Alert,
  Button,
  Card,
  Col,
  notification,
  Row,
  Space,
  Table,
  Tag,
  Tooltip,
} from "antd";
import {
  BRIDGE_BASE_CONTRACT_ADDRESS,
  BRIDGE_VAULT_ABI,
  formatWithCommas,
  type WalletState,
} from "../constants";
import { useCallback, useEffect, useState } from "react";
import { createPublicClient, formatEther, getContract, http } from "viem";
import { base } from "viem/chains";
import {
  ClockCircleOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  QuestionCircleOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined,
  ExportOutlined,
  ReloadOutlined,
  ImportOutlined,
} from "@ant-design/icons";

interface BridgeLogEntry {
  id: string;
  type: "Bridge Out" | "Bridge In";
  amount: string;
  chain: string;
  recipientAddress: string;
  status: string;
  statusColor: string;
  statusIcon: React.ReactNode;
  timestamp: string;
  txHash?: string;
  txProof?: string;
  depositId: number;
}

// Type definitions for contract return values
type DepositOutData = [
  bigint, // depositOutId
  string, // depositor
  bigint, // amount
  string, // receivingWalletAddress
  string, // chain
  number, // status
  string // txRelease
];

type DepositInData = [
  bigint, // depositInId
  string, // depositor
  bigint, // amount
  string, // receivingWalletAddress
  string, // chain
  number, // status
  string // txDepositProof
];

const BridgeLogsTab = ({ wallet }: { wallet: WalletState }) => {
  const [loading, setLoading] = useState(false);
  const [bridgeLogs, setBridgeLogs] = useState<BridgeLogEntry[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Viem client
  const publicClient = createPublicClient({
    chain: base,
    transport: http(
      "https://base-mainnet.g.alchemy.com/v2/EAF1m-3-59-iXzmNbA99cvWq9pFovfxu"
    ),
  });

  // Status mappings
  const getDepositOutStatus = (status: number) => {
    switch (status) {
      case 0:
        return {
          text: "Awaiting",
          color: "orange",
          icon: <ClockCircleOutlined />,
        };
      case 1:
        return {
          text: "Canceled",
          color: "red",
          icon: <CloseCircleOutlined />,
        };
      case 2:
        return {
          text: "Locked",
          color: "blue",
          icon: <QuestionCircleOutlined />,
        };
      case 3:
        return {
          text: "Finalized",
          color: "green",
          icon: <CheckCircleOutlined />,
        };
      default:
        return {
          text: "Unknown",
          color: "default",
          icon: <QuestionCircleOutlined />,
        };
    }
  };

  const getDepositInStatus = (status: number) => {
    switch (status) {
      case 0:
        return {
          text: "Awaiting",
          color: "orange",
          icon: <ClockCircleOutlined />,
        };
      case 1:
        return {
          text: "Finalized",
          color: "green",
          icon: <CheckCircleOutlined />,
        };
      case 2:
        return { text: "Invalid", color: "red", icon: <CloseCircleOutlined /> };
      default:
        return {
          text: "Unknown",
          color: "default",
          icon: <QuestionCircleOutlined />,
        };
    }
  };

  // Fetch bridge logs
  const fetchBridgeLogs = useCallback(async () => {
    if (!wallet.isConnected || !wallet.address) {
      setBridgeLogs([]);
      return;
    }

    try {
      setLoading(true);

      const bridgeContract = getContract({
        address: BRIDGE_BASE_CONTRACT_ADDRESS as `0x${string}`,
        abi: BRIDGE_VAULT_ABI,
        client: publicClient,
      });

      const logs: BridgeLogEntry[] = [];

      // We need to manually iterate through the holder's bridge lists
      // Since we can't get the length directly, we'll try to fetch until we get an error

      // Fetch Bridge Out logs
      let bridgeOutIndex = 0;
      while (true) {
        try {
          const depositOutId = await bridgeContract.read.holderBridgeOutList([
            wallet.address as `0x${string}`,
            BigInt(bridgeOutIndex),
          ]);

          const depositOut = (await bridgeContract.read.depositsOut([
            depositOutId,
          ])) as DepositOutData;

          const statusInfo = getDepositOutStatus(Number(depositOut[5]));

          logs.push({
            id: `out-${depositOutId}`,
            type: "Bridge Out",
            amount: formatWithCommas(formatEther(depositOut[2] as bigint)),
            chain: (depositOut[4] as string).toUpperCase(),
            recipientAddress: depositOut[3] as string,
            status: statusInfo.text,
            statusColor: statusInfo.color,
            statusIcon: statusInfo.icon,
            timestamp: `Deposit #${depositOutId}`,
            txHash: (depositOut[6] as string) || undefined,
            depositId: Number(depositOutId),
          });

          bridgeOutIndex++;
        } catch (error) {
          // No more entries
          break;
        }
      }

      // Fetch Bridge In logs
      let bridgeInIndex = 0;
      while (true) {
        try {
          const depositInId = await bridgeContract.read.holderBridgeInList([
            wallet.address as `0x${string}`,
            BigInt(bridgeInIndex),
          ]);

          const depositIn = (await bridgeContract.read.depositsIn([
            depositInId,
          ])) as DepositInData;

          const statusInfo = getDepositInStatus(Number(depositIn[5]));

          logs.push({
            id: `in-${depositInId}`,
            type: "Bridge In",
            amount: formatWithCommas(formatEther(depositIn[2] as bigint)),
            chain: (depositIn[4] as string).toUpperCase(),
            recipientAddress: depositIn[3] as string,
            status: statusInfo.text,
            statusColor: statusInfo.color,
            statusIcon: statusInfo.icon,
            timestamp: `Deposit #${depositInId}`,
            txProof: (depositIn[6] as string) || undefined,
            depositId: Number(depositInId),
          });

          bridgeInIndex++;
        } catch (error) {
          // No more entries
          break;
        }
      }

      // Sort by deposit ID (most recent first)
      logs.sort((a, b) => b.depositId - a.depositId);

      setBridgeLogs(logs);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Failed to fetch bridge logs:", error);
      notification.error({
        message: "Failed to Load Bridge Logs",
        description: "Could not fetch bridge transaction history",
      });
    } finally {
      setLoading(false);
    }
  }, [wallet.isConnected, wallet.address, publicClient]);

  // Auto-refresh on wallet connection
  useEffect(() => {
    if (wallet.isConnected) {
      fetchBridgeLogs();
    }
  }, [wallet.isConnected, fetchBridgeLogs]);

  // Table columns
  const columns = [
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 120,
      render: (type: string) => (
        <Space>
          {type === "Bridge Out" ? (
            <ArrowRightOutlined style={{ color: "#52c41a" }} />
          ) : (
            <ArrowLeftOutlined style={{ color: "#1890ff" }} />
          )}
          {type}
        </Space>
      ),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      width: 120,
      render: (amount: string) => <span>{amount}</span>,
    },
    {
      title: "Chain",
      dataIndex: "chain",
      key: "chain",
      width: 80,
      render: (chain: string) => <Tag color="blue">{chain}</Tag>,
    },
    {
      title: "Recipient",
      dataIndex: "recipientAddress",
      key: "recipientAddress",
      width: 200,
      render: (address: string) => (
        <Tooltip title={address}>
          {address.length > 20
            ? `${address.slice(0, 8)}...${address.slice(-8)}`
            : address}
        </Tooltip>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (_: any, record: BridgeLogEntry) => (
        <Tag color={record.statusColor} icon={record.statusIcon}>
          {record.status}
        </Tag>
      ),
    },
    {
      title: "ID",
      dataIndex: "timestamp",
      key: "timestamp",
      width: 100,
      render: (timestamp: string) => <span>{timestamp}</span>,
    },
    {
      title: "Proof/Hash",
      key: "proof",
      width: 120,
      render: (_: any, record: BridgeLogEntry) => {
        const hash = record.txHash || record.txProof;
        if (!hash) return <span></span>;

        return (
          <Tooltip title={hash}>
            <span>{hash.slice(0, 8)}...</span>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <Card style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2>
              <ExportOutlined style={{ marginRight: 8, color: "#722ed1" }} />
              Bridge Transaction History
            </h2>
            {lastRefresh && (
              <span>Last updated: {lastRefresh.toLocaleTimeString()}</span>
            )}
          </div>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchBridgeLogs}
            loading={loading}
            disabled={!wallet.isConnected}
          >
            Refresh
          </Button>
        </div>
      </Card>

      {!wallet.isConnected ? (
        <Alert
          message="Wallet Not Connected"
          description="Please connect your MetaMask wallet to view your bridge transaction history"
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      ) : (
        <>
          {/* Summary Cards */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Card size="small" style={{ textAlign: "center" }}>
                <ExportOutlined style={{ fontSize: 24, color: "#52c41a" }} />
                <div style={{ marginTop: 8 }}>
                  <span>Bridge Out</span>
                  <br />
                  <span>
                    {
                      bridgeLogs.filter((log) => log.type === "Bridge Out")
                        .length
                    }{" "}
                    transactions
                  </span>
                </div>
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" style={{ textAlign: "center" }}>
                <ImportOutlined style={{ fontSize: 24, color: "#1890ff" }} />
                <div style={{ marginTop: 8 }}>
                  <span>Bridge In</span>
                  <br />
                  <span>
                    {
                      bridgeLogs.filter((log) => log.type === "Bridge In")
                        .length
                    }{" "}
                    transactions
                  </span>
                </div>
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" style={{ textAlign: "center" }}>
                <CheckCircleOutlined
                  style={{ fontSize: 24, color: "#52c41a" }}
                />
                <div style={{ marginTop: 8 }}>
                  <span>Completed</span>
                  <br />
                  <span>
                    {
                      bridgeLogs.filter((log) => log.status === "Finalized")
                        .length
                    }{" "}
                    transactions
                  </span>
                </div>
              </Card>
            </Col>
          </Row>

          <Card>
            <Table
              columns={columns}
              dataSource={bridgeLogs}
              rowKey="id"
              loading={loading}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} transactions`,
              }}
              scroll={{ x: 800 }}
              locale={{
                emptyText: wallet.isConnected
                  ? "No bridge transactions found"
                  : "Connect wallet to view transactions",
              }}
              size="middle"
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default BridgeLogsTab;
