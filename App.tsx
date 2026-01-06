
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  RefreshCw, Search, ShieldCheck, Globe, 
  Zap, FileDown, Mail, AlertCircle, 
  Clock, HardDrive, X, ExternalLink, FileText, Download
} from 'lucide-react';
import { LinkType, LinkStatus, SubscriptionLink, EmailDeliveryRecord } from './types';
import { aggregateVpnLinks, validateLink, generateEmailSummary } from './services/geminiService';

const App: React.FC = () => {
  const [links, setLinks] = useState<SubscriptionLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<LinkType | '全部'>('全部');
  const [onlyFast, setOnlyFast] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [emailRecords, setEmailRecords] = useState<EmailDeliveryRecord[]>([]);
  const [showEmailHistory, setShowEmailHistory] = useState(false);

  const hasApiKey = !!process.env.API_KEY;

  const stats = useMemo(() => {
    const activeOnes = links.filter(l => l.status === LinkStatus.ACTIVE);
    return {
      total: links.length,
      active: activeOnes.length,
      fast: activeOnes.filter(l => l.ping && l.ping < 2000).length,
      avgPing: activeOnes.length > 0 ? Math.round(activeOnes.reduce((acc, curr) => acc + (curr.ping || 0), 0) / activeOnes.length) : 0
    };
  }, [links]);

  const copyToClipboard = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  const exportLinks = (type: LinkType | 'ALL', format: 'txt' | 'word' = 'txt') => {
    // 极速/全选的严格过滤
    const targetLinks = links.filter(l => {
      if (type !== 'ALL' && l.type !== type) return false;
      if (l.status !== LinkStatus.ACTIVE) return false;
      if (onlyFast && (!l.ping || l.ping >= 2000)) return false;
      return true;
    });

    if (targetLinks.length === 0) return alert(`当前分类 [${type}] 无可用节点`);

    let content = "";
    let fileName = `VPN_${type}_${new Date().toISOString().split('T')[0]}`;

    if (format === 'txt') {
      content = targetLinks.map(l => l.url).join('\n');
      fileName += ".txt";
    } else {
      content = `VPN 聚合巡检报告\n导出时间: ${new Date().toLocaleString()}\n分类: ${type}\n\n`;
      content += targetLinks.map((l, i) => `${i+1}. [${l.type}] ${l.title}\n   ${l.url}\n   延迟: ${l.ping}ms\n`).join('\n');
      fileName += ".doc";
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  };

  const runValidation = useCallback(async (targetLinks: SubscriptionLink[]) => {
    setSyncProgress('正在测速...');
    for (let i = 0; i < targetLinks.length; i++) {
      const link = targetLinks[i];
      const result = await validateLink(link.url);
      setLinks(current => {
        const next = current.map(l => l.id === link.id ? { ...l, ...result } : l);
        localStorage.setItem('vpn_sub_links', JSON.stringify(next));
        return next;
      });
    }
    setSyncProgress('');
  }, []);

  const handleSync = useCallback(async () => {
    if (isLoading || !hasApiKey) return;
    setIsLoading(true);
    setSyncProgress('AI 搜索中...');
    try {
      const newLinks = await aggregateVpnLinks();
      setLinks(prev => {
        const existingUrls = new Set(prev.map(l => l.url));
        const filteredNew = newLinks.filter(l => !existingUrls.has(l.url));
        const combined = [...filteredNew, ...prev].slice(0, 200);
        localStorage.setItem('vpn_sub_links', JSON.stringify(combined));
        if (filteredNew.length > 0) {
          setTimeout(() => runValidation(filteredNew), 100);
        } else {
          setSyncProgress('暂无新节点');
          setTimeout(() => setSyncProgress(''), 2000);
        }
        return combined;
      });
    } catch (err) {
      console.error(err);
      setSyncProgress('同步失败');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasApiKey, runValidation]);

  useEffect(() => {
    const saved = localStorage.getItem('vpn_sub_links');
    if (saved) {
      const parsed = JSON.parse(saved);
      setLinks(parsed);
      const untested = parsed.filter((l: any) => l.status === LinkStatus.TESTING);
      if (untested.length > 0) runValidation(untested);
    } else if (hasApiKey) {
      handleSync();
    }
  }, [hasApiKey]);

  const filteredLinks = useMemo(() => {
    return links.filter(link => {
      const matchesSearch = (link.title + link.source).toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = activeFilter === '全部' || link.type === activeFilter;
      const matchesFast = !onlyFast || (link.status === LinkStatus.ACTIVE && link.ping && link.ping < 2000);
      return matchesSearch && matchesType && matchesFast;
    });
  }, [links, searchTerm, activeFilter, onlyFast]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 pb-20">
      <div className="max-w-6xl mx-auto px-4 py-12">
        
        {!hasApiKey && (
          <div className="mb-8 bg-rose-500/10 border border-rose-500/30 p-4 rounded-2xl flex items-center gap-3 text-rose-400">
            <AlertCircle size={20} />
            <span className="font-bold">API_KEY 未配置，AI 抓取功能已禁用。</span>
          </div>
        )}

        <header className="mb-12 flex flex-col lg:flex-row justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black text-white tracking-tighter flex items-center gap-3 uppercase">
              <ShieldCheck className="text-blue-500" size={40} />
              VPN HUB
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">88506738@qq.com 自动化推送中</span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 items-center">
            {syncProgress && <span className="text-[10px] font-black text-blue-500 mr-2 animate-pulse uppercase">{syncProgress}</span>}
            <button 
              onClick={() => setOnlyFast(!onlyFast)}
              className={`px-4 py-2.5 rounded-xl font-bold transition-all border text-xs ${onlyFast ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-white/5 border-white/10 text-slate-500'}`}
            >
              ⚡ 极速过滤: {onlyFast ? 'ON' : 'OFF'}
            </button>
            <button 
              onClick={handleSync} 
              disabled={isLoading || !hasApiKey}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-black text-xs transition-all flex items-center gap-2"
            >
              <RefreshCw className={isLoading ? 'animate-spin' : ''} size={14} />
              同步节点
            </button>
          </div>
        </header>

        {/* 导出区 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10">
          <button onClick={() => exportLinks(LinkType.V2)} className="flex items-center justify-between p-5 bg-slate-900/60 border border-white/5 rounded-3xl hover:border-blue-500/40 transition-all group">
            <div className="flex items-center gap-4">
              <FileText className="text-blue-400" />
              <div className="text-left">
                <div className="text-sm font-black">V2Ray 导出</div>
                <div className="text-[10px] text-slate-500">仅导出 URI 列表 (.txt)</div>
              </div>
            </div>
            <Download size={18} className="text-slate-600 group-hover:text-white" />
          </button>
          <button onClick={() => exportLinks(LinkType.CLASH)} className="flex items-center justify-between p-5 bg-slate-900/60 border border-white/5 rounded-3xl hover:border-orange-500/40 transition-all group">
            <div className="flex items-center gap-4">
              <Zap className="text-orange-400" />
              <div className="text-left">
                <div className="text-sm font-black">Clash 导出</div>
                <div className="text-[10px] text-slate-500">仅导出 YAML 链接 (.txt)</div>
              </div>
            </div>
            <Download size={18} className="text-slate-600 group-hover:text-white" />
          </button>
          <button onClick={() => exportLinks('ALL', 'word')} className="flex items-center justify-between p-5 bg-slate-900/60 border border-white/5 rounded-3xl hover:border-emerald-500/40 transition-all group">
            <div className="flex items-center gap-4">
              <FileDown className="text-emerald-400" />
              <div className="text-left">
                <div className="text-sm font-black">全量报告</div>
                <div className="text-[10px] text-slate-500">导出详细 Word 文档</div>
              </div>
            </div>
            <Download size={18} className="text-slate-600 group-hover:text-white" />
          </button>
        </div>

        {/* 状态栏 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { l: '总库', v: stats.total, c: 'text-blue-400' },
            { l: '活跃', v: stats.active, c: 'text-emerald-400' },
            { l: '极速', v: stats.fast, c: 'text-amber-400' },
            { l: '延迟', v: `${stats.avgPing}ms`, c: 'text-indigo-400' },
          ].map((s, i) => (
            <div key={i} className="bg-slate-900/40 border border-white/5 p-5 rounded-3xl">
              <div className="text-2xl font-black text-white">{s.v}</div>
              <div className={`text-[10px] font-bold uppercase tracking-widest ${s.c}`}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* 搜索与过滤 */}
        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
            <input 
              type="text" 
              placeholder="搜索源名称..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 pl-14 pr-4 text-sm outline-none focus:border-blue-500/40"
            />
          </div>
          <div className="flex bg-slate-900 border border-white/10 rounded-2xl p-1">
            {['全部', 'Clash', 'V2Ray'].map(t => (
              <button 
                key={t}
                onClick={() => setActiveFilter(t as any)}
                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeFilter === t ? 'bg-white text-black' : 'text-slate-500 hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* 列表 */}
        <div className="space-y-3">
          {filteredLinks.length > 0 ? filteredLinks.map(link => (
            <div key={link.id} className="group bg-slate-900/30 border border-white/5 p-4 rounded-3xl hover:bg-slate-800/40 transition-all flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${link.type === LinkType.CLASH ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400'}`}>
                  {link.type === LinkType.CLASH ? <Zap size={18} /> : <Globe size={18} />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-sm truncate">{link.title}</h3>
                    <span className="text-[9px] font-black border border-white/10 px-1.5 rounded opacity-40 uppercase">{link.type}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-500 truncate max-w-[150px]">{link.source}</span>
                    {link.ping && (
                      <span className={`text-[10px] font-black ${link.ping < 1000 ? 'text-green-500' : link.ping < 2000 ? 'text-amber-500' : 'text-rose-500'}`}>
                        {link.ping}ms
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => copyToClipboard(link.url, link.id)}
                className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${copiedId === link.id ? 'bg-green-600 text-white' : 'bg-white text-black hover:bg-slate-200'}`}
              >
                {copiedId === link.id ? 'DONE' : 'COPY'}
              </button>
            </div>
          )) : (
            <div className="text-center py-24 bg-slate-900/20 rounded-[3rem] border border-dashed border-white/5 text-slate-600 font-black italic">
              AI 尚未发现符合要求的极速节点
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
