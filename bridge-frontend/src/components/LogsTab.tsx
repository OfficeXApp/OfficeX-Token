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
  Popconfirm,
} from "antd";
import {
  BRIDGE_BASE_CONTRACT_ADDRESS,
  BRIDGE_VAULT_ABI,
  formatWithCommas,
  type TokenInfo,
  type WalletState,
} from "../constants";
import { useCallback, useEffect, useState } from "react";
import {
  createPublicClient,
  formatEther,
  getContract,
  http,
  createWalletClient,
  custom,
} from "viem";
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
  SwapOutlined,
  RetweetOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import WalletSection from "./WalletSection";

interface BridgeLogEntry {
  id: string;
  type: "Bridge Out" | "Bridge In" | "Wrap" | "Unwrap";
  amount: string;
  chain?: string;
  recipientAddress?: string;
  status: string;
  statusColor: string;
  statusIcon: React.ReactNode;
  timestamp: string;
  txHash?: string;
  txProof?: string;
  depositId?: number;
  operationId?: number;
  blockNumber?: string;
  sortKey: number; // Add sort key for proper ordering
}

// Type definitions for contract return values
type DepositOutData = [
  bigint, // depositOutId
  string, // depositor
  bigint, // amount
  string, // receivingWalletAddress
  string, // chain
  number, // status
  string, // txRelease
  bigint // timestamp
];

type DepositInData = [
  bigint, // depositInId
  string, // depositor
  bigint, // amount
  string, // receivingWalletAddress
  string, // chain
  number, // status
  string, // txDepositProof
  bigint // timestamp
];

type WrapOperationData = [
  bigint, // wrapOperationId
  string, // user
  bigint, // amount
  number, // operationType (0 = WRAP, 1 = UNWRAP)
  bigint, // timestamp
  bigint // blockNumber
];

// Create client outside component to prevent recreation
const publicClient = createPublicClient({
  chain: base,
  transport: http(
    "https://base-mainnet.g.alchemy.com/v2/EAF1m-3-59-iXzmNbA99cvWq9pFovfxu"
  ),
});

const BridgeLogsTab = ({
  wallet,
  bridgeInventory,
  setWallet,
  tokenInfo,
}: {
  wallet: WalletState;
  bridgeInventory: string;
  setWallet: (wallet: WalletState) => void;
  tokenInfo: {
    base: TokenInfo | null;
    ancient: TokenInfo | null;
  };
}) => {
  const [loading, setLoading] = useState(false);
  const [bridgeLogs, setBridgeLogs] = useState<BridgeLogEntry[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [cancellingIds, setCancellingIds] = useState<Set<number>>(new Set());

  // Get wallet client for transactions
  const getWalletClient = useCallback(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      return createWalletClient({
        chain: base,
        transport: custom(window.ethereum),
      });
    }
    return null;
  }, []);

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

  const getWrapOperationStatus = () => {
    // Wrap operations are always completed once recorded
    return {
      text: "Completed",
      color: "green",
      icon: <CheckCircleOutlined />,
    };
  };

  // Cancel bridge function
  const handleCancelBridge = useCallback(
    async (depositId: number) => {
      const walletClient = getWalletClient();
      if (!walletClient || !wallet.isConnected) {
        notification.error({
          message: "Wallet Not Connected",
          description:
            "Please connect your wallet to cancel the bridge request",
        });
        return;
      }

      try {
        setCancellingIds((prev) => new Set(prev).add(depositId));

        const hash = await walletClient.writeContract({
          address: BRIDGE_BASE_CONTRACT_ADDRESS as `0x${string}`,
          abi: BRIDGE_VAULT_ABI,
          functionName: "cancelBridge",
          args: [BigInt(depositId)],
          account: wallet.address as `0x${string}`,
        });

        await publicClient.waitForTransactionReceipt({ hash });

        notification.success({
          message: "Bridge Canceled",
          description:
            "Your bridge request has been successfully canceled and tokens returned",
        });

        // Refresh the logs to show updated status
        await fetchBridgeLogs();
      } catch (error) {
        console.error("Cancel bridge failed:", error);
        notification.error({
          message: "Cancel Failed",
          description: "Failed to cancel bridge request. Please try again.",
        });
      } finally {
        setCancellingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(depositId);
          return newSet;
        });
      }
    },
    [getWalletClient, wallet.isConnected, wallet.address]
  );

  // Fetch all deposit IDs using pagination
  const fetchAllDepositIds = async (
    contract: any,
    walletAddress: string,
    type: "bridgeOut" | "bridgeIn"
  ): Promise<bigint[]> => {
    const allIds: bigint[] = [];
    let offset = 0;
    const limit = 50; // Fetch 50 at a time

    while (true) {
      try {
        const ids = await (type === "bridgeOut"
          ? contract.read.getHolderBridgeOutHistory([
              walletAddress as `0x${string}`,
              BigInt(offset),
              BigInt(limit),
            ])
          : contract.read.getHolderBridgeInHistory([
              walletAddress as `0x${string}`,
              BigInt(offset),
              BigInt(limit),
            ]));

        // If no more results, break
        if (!ids || ids.length === 0) {
          break;
        }

        allIds.push(...ids);

        // If we got less than the limit, we've reached the end
        if (ids.length < limit) {
          break;
        }

        offset += limit;
      } catch (error) {
        console.error(`Error fetching ${type} IDs at offset ${offset}:`, error);
        break;
      }
    }

    return allIds;
  };

  // Fetch all wrap operation IDs using pagination
  const fetchAllWrapOperationIds = async (
    contract: any,
    walletAddress: string
  ): Promise<bigint[]> => {
    const allIds: bigint[] = [];
    let offset = 0;
    const limit = 50; // Fetch 50 at a time

    while (true) {
      try {
        const ids = await contract.read.getHolderAncientHistory([
          walletAddress as `0x${string}`,
          BigInt(offset),
          BigInt(limit),
        ]);

        // If no more results, break
        if (!ids || ids.length === 0) {
          break;
        }

        allIds.push(...ids);

        // If we got less than the limit, we've reached the end
        if (ids.length < limit) {
          break;
        }

        offset += limit;
      } catch (error) {
        console.error(
          `Error fetching wrap operation IDs at offset ${offset}:`,
          error
        );
        break;
      }
    }

    return allIds;
  };

  // Fetch deposit details in batches
  const fetchDepositDetails = async (
    contract: any,
    ids: bigint[],
    type: "bridgeOut" | "bridgeIn"
  ): Promise<BridgeLogEntry[]> => {
    const logs: BridgeLogEntry[] = [];
    const batchSize = 10; // Process 10 deposits at a time

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);

      try {
        const batchPromises = batch.map(async (id) => {
          if (type === "bridgeOut") {
            const depositOut = (await contract.read.depositsOut([
              id,
            ])) as DepositOutData;
            const statusInfo = getDepositOutStatus(Number(depositOut[5]));

            return {
              id: `out-${id}`,
              type: "Bridge Out" as const,
              amount: formatWithCommas(formatEther(depositOut[2] as bigint)),
              chain: (depositOut[4] as string).toUpperCase(),
              recipientAddress: depositOut[3] as string,
              status: statusInfo.text,
              statusColor: statusInfo.color,
              statusIcon: statusInfo.icon,
              timestamp: (Number(depositOut[7].toString()) * 1000).toString(),
              txHash: (depositOut[6] as string) || undefined,
              depositId: Number(id),
              sortKey: Number(id), // Use deposit ID as sort key
            };
          } else {
            const depositIn = (await contract.read.depositsIn([
              id,
            ])) as DepositInData;
            const statusInfo = getDepositInStatus(Number(depositIn[5]));

            return {
              id: `in-${id}`,
              type: "Bridge In" as const,
              amount: formatWithCommas(formatEther(depositIn[2] as bigint)),
              chain: (depositIn[4] as string).toUpperCase(),
              recipientAddress: depositIn[3] as string,
              status: statusInfo.text,
              statusColor: statusInfo.color,
              statusIcon: statusInfo.icon,
              timestamp: (Number(depositIn[7].toString()) * 1000).toString(),
              txProof: (depositIn[6] as string) || undefined,
              depositId: Number(id),
              sortKey: Number(id), // Use deposit ID as sort key
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        logs.push(...batchResults);

        // Small delay between batches to be nice to the RPC
        if (i + batchSize < ids.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(
          `Error fetching batch ${Math.floor(i / batchSize) + 1}:`,
          error
        );
        // Continue with next batch even if current batch fails
      }
    }

    return logs;
  };

  // Fetch wrap operation details in batches
  const fetchWrapOperationDetails = async (
    contract: any,
    ids: bigint[]
  ): Promise<BridgeLogEntry[]> => {
    const logs: BridgeLogEntry[] = [];
    const batchSize = 10; // Process 10 operations at a time

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);

      try {
        const batchPromises = batch.map(async (id) => {
          const wrapOp = (await contract.read.ancientWrapOperations([
            id,
          ])) as WrapOperationData;

          const statusInfo = getWrapOperationStatus();
          const operationType = Number(wrapOp[3]); // 0 = WRAP, 1 = UNWRAP
          const timestamp = new Date(Number(wrapOp[4]) * 1000);

          return {
            id: `wrap-${id}`,
            // @ts-ignore
            type: (operationType === 0 ? "Wrap" : "Unwrap") as const,
            amount: formatWithCommas(formatEther(wrapOp[2] as bigint)),
            status: statusInfo.text,
            statusColor: statusInfo.color,
            statusIcon: statusInfo.icon,
            timestamp: timestamp.getTime().toString(),
            operationId: Number(id),
            blockNumber: wrapOp[5].toString(),
            sortKey: Number(wrapOp[4]), // Use timestamp as sort key for wrap operations
          };
        });

        const batchResults = await Promise.all(batchPromises);
        logs.push(...batchResults);

        // Small delay between batches to be nice to the RPC
        if (i + batchSize < ids.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(
          `Error fetching wrap operation batch ${
            Math.floor(i / batchSize) + 1
          }:`,
          error
        );
        // Continue with next batch even if current batch fails
      }
    }

    return logs;
  };

  // Fetch bridge logs using pagination methods
  const fetchBridgeLogs = useCallback(async () => {
    if (!wallet.isConnected || !wallet.address) {
      setBridgeLogs([]);
      return;
    }

    console.log("🔄 Starting fetchBridgeLogs for:", wallet.address);

    try {
      setLoading(true);

      const bridgeContract = getContract({
        address: BRIDGE_BASE_CONTRACT_ADDRESS as `0x${string}`,
        abi: BRIDGE_VAULT_ABI,
        client: publicClient,
      });

      console.log(
        "Fetching deposit IDs and wrap operations for wallet:",
        wallet.address
      );

      // Fetch all deposit IDs and wrap operation IDs using the pagination methods
      const [bridgeOutIds, bridgeInIds, wrapOperationIds] = await Promise.all([
        fetchAllDepositIds(bridgeContract, wallet.address, "bridgeOut"),
        fetchAllDepositIds(bridgeContract, wallet.address, "bridgeIn"),
        fetchAllWrapOperationIds(bridgeContract, wallet.address),
      ]);

      console.log(
        `Found ${bridgeOutIds.length} bridge out deposits, ${bridgeInIds.length} bridge in deposits, and ${wrapOperationIds.length} wrap operations`
      );

      // Fetch details for all types
      const [bridgeOutLogs, bridgeInLogs, wrapOperationLogs] =
        await Promise.all([
          fetchDepositDetails(bridgeContract, bridgeOutIds, "bridgeOut"),
          fetchDepositDetails(bridgeContract, bridgeInIds, "bridgeIn"),
          fetchWrapOperationDetails(bridgeContract, wrapOperationIds),
        ]);

      const allLogs = [...bridgeOutLogs, ...bridgeInLogs, ...wrapOperationLogs];

      // Sort by sortKey (most recent first)
      allLogs.sort((a, b) => {
        return Number(b.timestamp) - Number(a.timestamp);
      });

      setBridgeLogs(allLogs);
      setLastRefresh(new Date());

      console.log(
        `✅ Successfully loaded ${allLogs.length} total transactions (${bridgeOutLogs.length} bridge out, ${bridgeInLogs.length} bridge in, ${wrapOperationLogs.length} wrap operations)`
      );
    } catch (error) {
      console.error("Failed to fetch bridge logs:", error);
      notification.error({
        message: "Failed to Load Transaction History",
        description: "Could not fetch transaction history. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [wallet.isConnected, wallet.address]);

  // Auto-refresh on wallet connection - only trigger when wallet connection status changes
  useEffect(() => {
    console.log(
      "🎯 useEffect triggered - wallet.isConnected:",
      wallet.isConnected,
      "wallet.address:",
      wallet.address
    );
    if (wallet.isConnected && wallet.address) {
      fetchBridgeLogs();
    }
  }, [wallet.isConnected, wallet.address, fetchBridgeLogs]);

  // Table columns
  const columns = [
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 120,
      render: (type: string) => (
        <Space>
          {type === "Bridge Out" && (
            <ArrowRightOutlined style={{ color: "#52c41a" }} />
          )}
          {type === "Bridge In" && (
            <ArrowLeftOutlined style={{ color: "#1890ff" }} />
          )}
          {type === "Wrap" && <SwapOutlined style={{ color: "#722ed1" }} />}
          {type === "Unwrap" && (
            <RetweetOutlined style={{ color: "#fa8c16" }} />
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
      title: "Chain/Type",
      key: "chainOrType",
      width: 100,
      render: (_: any, record: BridgeLogEntry) => {
        if (record.chain) {
          return <Tag color="blue">{record.chain}</Tag>;
        }
        if (record.type === "Wrap") {
          return <Tag color="purple">Ancient → New</Tag>;
        }
        if (record.type === "Unwrap") {
          return <Tag color="orange">New → Ancient</Tag>;
        }
        return <span>-</span>;
      },
    },
    {
      title: "Recipient",
      dataIndex: "recipientAddress",
      key: "recipientAddress",
      width: 200,
      render: (address: string) => {
        if (!address) return <span>-</span>;
        return (
          <Tooltip title={address}>
            <a
              href={
                address.startsWith("0x")
                  ? `https://basescan.org/address/${address}`
                  : `https://solscan.io/address/${address}`
              }
              target="_blank"
            >
              {address.length > 20
                ? `${address.slice(0, 8)}...${address.slice(-8)}`
                : address}
            </a>
          </Tooltip>
        );
      },
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
    // Updated column definition for "ID/Time"
    {
      title: "ID/Time",
      dataIndex: "timestamp",
      key: "timestamp",
      width: 150,
      render: (timestamp: string, record: BridgeLogEntry) => {
        if (record.type === "Wrap" || record.type === "Unwrap") {
          return (
            <div>
              <div>Op #{record.operationId}</div>
              <small style={{ color: "#666" }}>
                {new Date(Number(timestamp)).toLocaleString()}
              </small>
            </div>
          );
        }

        // For Bridge Out/In transactions, show deposit ID
        if (record.type === "Bridge Out" || record.type === "Bridge In") {
          return (
            <div>
              <div>Dep #{record.depositId}</div>
              <small style={{ color: "#666" }}>
                {new Date(Number(timestamp)).toLocaleString()}
              </small>
            </div>
          );
        }

        // Fallback for any other transaction types
        return (
          <span>{new Date(Number(timestamp) * 1000).toLocaleString()}</span>
        );
      },
    },
    {
      title: "Proof/Hash",
      key: "proof",
      width: 120,
      render: (_: any, record: BridgeLogEntry) => {
        const hash = record.txHash || record.txProof;
        if (!hash) {
          if (record.blockNumber) {
            return (
              <Tooltip title={`Block #${record.blockNumber}`}>
                <a
                  href={`https://basescan.org/block/${record.blockNumber}`}
                  target="_blank"
                >
                  Block #{record.blockNumber.slice(-4)}
                </a>
              </Tooltip>
            );
          }
          return <span>-</span>;
        }

        return (
          <Tooltip title={hash}>
            <a
              href={
                hash.startsWith("0x")
                  ? `https://basescan.org/tx/${hash}`
                  : `https://solscan.io/tx/${hash}`
              }
              target="_blank"
            >
              <span>{hash.slice(0, 8)}...</span>
            </a>
          </Tooltip>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_: any, record: BridgeLogEntry) => {
        console.log(record);
        // Only show cancel button for Bridge Out transactions in Awaiting status
        if (record.type === "Bridge Out" && record.status === "Awaiting") {
          const isLoading = cancellingIds.has(record.depositId || -1);

          return (
            <Popconfirm
              title="Cancel Bridge Request"
              description="Are you sure you want to cancel this bridge request? Your tokens will be returned."
              onConfirm={() => handleCancelBridge(record.depositId!)}
              okText="Yes, Cancel"
              cancelText="No"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="text"
                icon={<DeleteOutlined />}
                size="small"
                danger
                loading={isLoading}
                disabled={!wallet.isConnected}
                title="Cancel Bridge Request"
              >
                Cancel
              </Button>
            </Popconfirm>
          );
        }
        return <span>-</span>;
      },
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <WalletSection
        wallet={wallet}
        setWallet={setWallet}
        tokenInfo={tokenInfo}
        bridgeInventory={bridgeInventory}
      />
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
              Transaction History
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
          description="Please connect your MetaMask wallet to view your transaction history"
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      ) : (
        <>
          {/* Summary Cards */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card size="small" style={{ textAlign: "center" }}>
                <ExportOutlined style={{ fontSize: 24, color: "#52c41a" }} />
                <div style={{ marginTop: 8 }}>
                  <span>Bridge Out</span>
                  <br />
                  <span>
                    {
                      bridgeLogs.filter((log) => log.type === "Bridge Out")
                        .length
                    }
                  </span>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ textAlign: "center" }}>
                <ImportOutlined style={{ fontSize: 24, color: "#1890ff" }} />
                <div style={{ marginTop: 8 }}>
                  <span>Bridge In</span>
                  <br />
                  <span>
                    {
                      bridgeLogs.filter((log) => log.type === "Bridge In")
                        .length
                    }
                  </span>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ textAlign: "center" }}>
                <SwapOutlined style={{ fontSize: 24, color: "#722ed1" }} />
                <div style={{ marginTop: 8 }}>
                  <span>Wrap</span>
                  <br />
                  <span>
                    {bridgeLogs.filter((log) => log.type === "Wrap").length}
                  </span>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ textAlign: "center" }}>
                <RetweetOutlined style={{ fontSize: 24, color: "#fa8c16" }} />
                <div style={{ marginTop: 8 }}>
                  <span>Unwrap</span>
                  <br />
                  <span>
                    {bridgeLogs.filter((log) => log.type === "Unwrap").length}
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
              scroll={{ x: 1000 }}
              locale={{
                emptyText: wallet.isConnected
                  ? "No transactions found"
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
