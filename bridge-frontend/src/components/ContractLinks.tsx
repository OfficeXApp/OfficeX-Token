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
import { Card, Space, Typography } from "antd";
import {
  ANCIENT_BASE_TOKEN,
  BASE_TOKEN,
  BRIDGE_BASE_CONTRACT_ADDRESS,
  SOLANA_TOKEN,
} from "../constants";

const { Title, Paragraph, Text } = Typography;

const ContractLinks = () => {
  return (
    <Card style={{ marginBottom: 24 }}>
      <Title level={4}>Contract Addresses</Title>
      <Space direction="vertical" style={{ width: "100%" }}>
        <div>
          <Text strong>Bridge Contract: </Text>
          <a
            href={`https://basescan.org/address/${BRIDGE_BASE_CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {BRIDGE_BASE_CONTRACT_ADDRESS} <ExportOutlined />
          </a>
        </div>
        <div>
          <Text strong>Base Token: </Text>
          <a
            href={`https://basescan.org/address/${BASE_TOKEN}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {BASE_TOKEN} <ExportOutlined />
          </a>
        </div>
        <div>
          <Text strong>Ancient Token: </Text>
          <a
            href={`https://basescan.org/address/${ANCIENT_BASE_TOKEN}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {ANCIENT_BASE_TOKEN} <ExportOutlined />
          </a>
        </div>
        <div>
          <Text strong>Solana Token: </Text>
          <a
            href={`https://solscan.io/address/${SOLANA_TOKEN}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {SOLANA_TOKEN} <ExportOutlined />
          </a>
        </div>
      </Space>
    </Card>
  );
};

export default ContractLinks;
