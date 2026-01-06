
import { GoogleGenAI } from "@google/genai";
import { LinkType, LinkStatus, SubscriptionLink } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

function extractUrls(text: string): string[] {
  // 专门匹配常见的 GitHub Raw 和订阅链接模式
  const urlRegex = /https?:\/\/(?:raw\.githubusercontent\.com|github\.com|nodesave\.com|freeclashx\.com)[^\s"<>`*]+[^\s"<>`*.,!?;:]/g;
  const matches = text.match(urlRegex) || [];
  return Array.from(new Set(matches.map(url => url.replace(/[\\`*]$/, ''))));
}

export async function aggregateVpnLinks(): Promise<SubscriptionLink[]> {
  if (!process.env.API_KEY) return [];
  
  try {
    const prompt = `
      请搜索并提供最新的免费 VPN 订阅链接（2025年活跃）。
      要求：
      1. 优先寻找 GitHub 仓库中的 raw 文件路径，例如以 .yaml, .yml, .txt 结尾的原始链接。
      2. 分类包含：Clash (YAML 格式), V2Ray/Trojan/SS (URI 列表或 Base64 格式)。
      3. 排除 GitHub 仓库首页，只提供具体的订阅文件 URL。
      4. 格式：每行一个 URL，不要有任何额外解释。
      
      重点搜索源：
      - raw.githubusercontent.com/.../clash.yaml
      - raw.githubusercontent.com/.../v2ray.txt
      - node.freeclashx.com
      - 其他活跃的聚合订阅源。
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const responseText = response.text || "";
    const detectedLinks: SubscriptionLink[] = [];
    const seenUrls = new Set<string>();

    const processUrl = (url: string, title: string) => {
      const cleanUrl = url.trim().replace(/[\\`*]$/, '');
      // 过滤非订阅链接（如设置页面、项目主页等）
      if (!seenUrls.has(cleanUrl) && isPotentiallySubscription(cleanUrl)) {
        detectedLinks.push(createLinkObject(cleanUrl, title || "自动采集源"));
        seenUrls.add(cleanUrl);
      }
    };

    // 从搜索来源获取
    groundingChunks.forEach((chunk: any) => {
      if (chunk.web?.uri) processUrl(chunk.web.uri, chunk.web.title);
    });

    // 从 AI 生成的内容中提取
    extractUrls(responseText).forEach((url, i) => processUrl(url, `AI 提取节点 ${i + 1}`));

    return detectedLinks;
  } catch (error) {
    console.error("Aggregation Failed:", error);
    return [];
  }
}

export async function generateEmailSummary(links: SubscriptionLink[]): Promise<string> {
  if (!process.env.API_KEY) return "本地测试：同步链路正常。";
  const fastCount = links.filter(l => l.ping && l.ping < 2000).length;
  const prompt = `分析结果：当前节点池共 ${links.length} 个，极速节点 ${fastCount} 个。请提供 20 字以内的专业简评。`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "数据已更新，节点质量优良。";
  } catch {
    return "节点自动巡检完成。";
  }
}

function isPotentiallySubscription(url: string): boolean {
  const lowUrl = url.toLowerCase();
  // 必须包含常见的订阅特征
  const hasSubFeature = ['sub', 'clash', 'v2ray', 'node', 'yaml', 'yml', 'txt', 'free', 'subscribe'].some(k => lowUrl.includes(k));
  // 排除项目主页和无关页面
  const isNotPage = !['/tree/main', '/blob/main', '/settings/', 'google.com', 'bing.com'].some(k => lowUrl.includes(k));
  return hasSubFeature && isNotPage;
}

function createLinkObject(url: string, title: string): SubscriptionLink {
  const lowUrl = url.toLowerCase();
  let type = LinkType.UNKNOWN;

  // 1. 强特征判断：后缀名
  if (lowUrl.endsWith('.yaml') || lowUrl.endsWith('.yml')) {
    type = LinkType.CLASH;
  } 
  // 2. 弱特征判断：路径关键字 (且排除冲突)
  else if (lowUrl.includes('clash') && !lowUrl.includes('v2ray')) {
    type = LinkType.CLASH;
  }
  else if (lowUrl.includes('v2ray') || lowUrl.includes('/v2') || lowUrl.includes('vmess') || lowUrl.endsWith('.txt')) {
    type = LinkType.V2;
  }
  // 3. 常见聚合源识别
  else if (lowUrl.includes('sub')) {
    type = LinkType.V2;
  }

  let host = "unknown";
  try { host = new URL(url).hostname; } catch {}
  
  return {
    id: Math.random().toString(36).substr(2, 9),
    url,
    title: title || "未命名源",
    source: host,
    type: type,
    status: LinkStatus.TESTING,
    updatedAt: new Date().toISOString(),
  };
}

export async function validateLink(url: string): Promise<{ status: LinkStatus; ping: number }> {
  const start = Date.now();
  try {
    // 采用更稳健的检测方式
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); 
    
    await fetch(url, { method: 'HEAD', mode: 'no-cors', signal: controller.signal });
    clearTimeout(timeoutId);
    
    const ping = Date.now() - start;
    return { status: LinkStatus.ACTIVE, ping };
  } catch {
    return { status: LinkStatus.EXPIRED, ping: 9999 };
  }
}
