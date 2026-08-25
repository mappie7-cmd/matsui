// ─────────────────────────────────────────────────────────
// これは「業務アプリの画面」です。宣伝ページ（LP）ではありません。
//
// docs/03_spec.md の要件定義書にそって作られた、
// 中小企業診断士の受講カリキュラム進捗管理ツールです。
//
// 画面の骨格（この形は崩さない）:
//   左メニュー（.side）＋ 上部バー（.topbar）＋ 本体（.content）
//   一覧 / 新規登録 / 設定 の3画面を view で切り替える
// ─────────────────────────────────────────────────────────
"use client";

import { useEffect, useMemo, useState } from "react";

// ═══════════════════════════════════════════════════════════
//  画面の型 ── docs/03_spec.md「0. 画面の型」のとおりに設定
// ═══════════════════════════════════════════════════════════

/** 色み。士業（中小企業診断士）向けなので落ち着いた紺 */
const TONE = "indigo";

/** 密度。年1カリキュラム・4〜5年で件数は少なく、1件が重いので roomy */
const DENSITY = "roomy";

/** 画面の型。「どこまで進んだか」を軸にするので stage（段階ごとに束ねる） */
const LAYOUT: "queue" | "stage" | "due" = "stage";

/** 数え方。カリキュラムは「1回・2回…」と数える */
const UNIT = "回";

/** 区分の選択肢。stage なので、これが受講の段階になる（受講済みは別枠で管理） */
const CATEGORIES = ["未受講", "受講予定"];

// ═══════════════════════════════════════════════════════════

/** 1件のデータ＝カリキュラム1回分 */
type Record = {
  id: string;
  name: string;      // カリキュラム名（テーマ）
  term: string;      // 年度・回（例：2年目 第3回）
  category: string;  // 受講状況（未受講／受講予定）。受講済みかどうかは done で管理
  note: string;       // 理解度メモ
  date: string;       // YYYY-MM-DD。受講日（未定なら空文字）
  done: boolean;      // 受講済みか
};

type View = "list" | "new" | "settings";
type Filter = "open" | "done" | "all";

const KEY = "curriculum-data";
const NAME_KEY = "curriculum-appname";

/** 画面の型ごとの言葉 */
const TEXT = {
  queue: {
    sub: "未対応のものが、待たせている順に並びます",
    open: "未対応", done: "対応済",
    toTo: "対応済みにする", toBack: "未対応に戻す",
    dateLabel: "受けた日", catLabel: "区分",
    stat2: "3日以上 放置",
    headOpen: "未対応（待たせている順）",
  },
  stage: {
    sub: "残りのカリキュラムが、あとどれだけあるかが分かります",
    open: "残り", done: "受講済み",
    toTo: "受講済みにする", toBack: "未受講に戻す",
    dateLabel: "受講日", catLabel: "受講状況",
    stat2: "7日以上 未更新",
    headOpen: "残り（未受講・受講予定）",
  },
  due: {
    sub: "期限が近い順に並びます",
    open: "未完了", done: "完了",
    toTo: "完了にする", toBack: "未完了に戻す",
    dateLabel: "期限", catLabel: "種別",
    stat2: "期限切れ",
    headOpen: "未完了（期限が近い順）",
  },
}[LAYOUT];

/** n日前の日付。マイナスを渡すとn日後 */
const ago = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const today = () => ago(0);

/** 今日との差。0=今日、-3=3日過ぎている、+2=あと2日 */
const diff = (d: string) =>
  Math.round(
    (new Date(d + "T00:00:00").getTime() - new Date(today() + "T00:00:00").getTime()) / 86400000
  );

/** 何日経ったか（日付が無いときは NaN → 対象外になる） */
const waiting = (d: string) => (d ? Math.max(0, -diff(d)) : NaN);

/**
 * 見本データ。中小企業診断士の受講カリキュラム（1年目〜5年目）を想定した架空のもの。
 * ⚠ 実在の人名・会社名・連絡先は使わない
 */
const SAMPLE: Record[] = [
  { id: "s01", name: "経営戦略とマーケティング",                 term: "1年目 第1回", category: "受講予定", note: "特に問題なく理解できた",           date: ago(180), done: true },
  { id: "s02", name: "企業経営理論",                             term: "1年目 第2回", category: "受講予定", note: "戦略論の部分は復習が必要",         date: ago(150), done: true },
  { id: "s03", name: "財務・会計",                               term: "1年目 第3回", category: "受講予定", note: "財務諸表分析は要復習",             date: ago(120), done: true },
  { id: "s04", name: "運営管理（オペレーション）",               term: "1年目 第4回", category: "受講予定", note: "生産管理の指標は理解できた",       date: ago(95),  done: true },
  { id: "s05", name: "経営法務",                                 term: "1年目 第5回", category: "受講予定", note: "特になし",                         date: ago(70),  done: true },
  { id: "s06", name: "中小企業経営・政策",                       term: "2年目 第1回", category: "未受講",   note: "",                                  date: "",       done: false },
  { id: "s07", name: "情報システムとITの活用",                   term: "2年目 第2回", category: "受講予定", note: "教材は届いている",                 date: ago(-14), done: false },
  { id: "s08", name: "経営情報システム演習",                     term: "2年目 第3回", category: "未受講",   note: "",                                  date: "",       done: false },
  { id: "s09", name: "企業診断実務Ⅰ",                           term: "2年目 第4回", category: "受講予定", note: "グループワークの準備が必要",       date: ago(-30), done: false },
  { id: "s10", name: "地域活性化と中小企業支援",                 term: "3年目 第1回", category: "未受講",   note: "",                                  date: "",       done: false },
  { id: "s11", name: "事業承継・M&A",                            term: "3年目 第2回", category: "未受講",   note: "",                                  date: "",       done: false },
  { id: "s12", name: "デジタルトランスフォーメーション実践",     term: "4年目 第1回", category: "未受講",   note: "",                                  date: "",       done: false },
  { id: "s13", name: "経営診断実務Ⅱ（総仕上げ）",               term: "4年目 第2回", category: "未受講",   note: "",                                  date: "",       done: false },
  { id: "s14", name: "独立診断士のための実務補習まとめ",         term: "5年目 第1回", category: "未受講",   note: "",                                  date: "",       done: false },
];

/** 一覧をどう束ねるか。LAYOUT ごとに変わる */
type Group = { key: string; label: string; mark?: "late" | "now"; items: Record[] };

function grouped(list: Record[], filter: Filter): Group[] {
  const head = filter === "open" ? TEXT.headOpen : filter === "done" ? TEXT.done : "すべて";

  if (LAYOUT === "stage" && filter === "open") {
    // 段階（受講状況）ごとに束ねる。CATEGORIES の順に並べ、中身が無い段階は出さない
    return CATEGORIES.map((c) => ({
      key: c,
      label: c,
      mark: undefined,
      items: list.filter((i) => i.category === c),
    })).filter((g) => g.items.length > 0);
  }

  if (LAYOUT === "due" && filter === "open") {
    const buckets: Group[] = [
      { key: "late",  label: "期限が過ぎている", mark: "late", items: [] },
      { key: "now",   label: "今日・明日",       mark: "now",  items: [] },
      { key: "week",  label: "今週のうち",                     items: [] },
      { key: "later", label: "それ以降",                       items: [] },
    ];
    list.forEach((i) => {
      const d = diff(i.date);
      if (d < 0) buckets[0].items.push(i);
      else if (d <= 1) buckets[1].items.push(i);
      else if (d <= 7) buckets[2].items.push(i);
      else buckets[3].items.push(i);
    });
    return buckets.filter((b) => b.items.length > 0);
  }

  return [{ key: "all", label: head, items: list }];
}

/** 行の右に出す小さなバッジ。日程が決まっていないもの／7日以上動きがないものに付く */
function rowBadge(r: Record): { text: string; kind: "warn" | "danger" } | null {
  if (r.done) return null;
  if (!r.date) return { text: "日程未定", kind: "warn" };
  const w = waiting(r.date);
  return w >= 7 ? { text: `${w}日 未更新`, kind: "warn" } : null;
}

export default function Home() {
  const [items, setItems] = useState<Record[]>([]);
  const [appName, setAppName] = useState("受講カリキュラム管理");
  const [loaded, setLoaded] = useState(false);

  const [view, setView] = useState<View>("list");
  const [filter, setFilter] = useState<Filter>("open");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Record | null>(null);

  const [form, setForm] = useState({ name: "", term: "", category: CATEGORIES[0], note: "", date: "" });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      setItems(raw ? (JSON.parse(raw) as Record[]) : SAMPLE);
      const n = localStorage.getItem(NAME_KEY);
      if (n) setAppName(n);
    } catch {
      setItems(SAMPLE);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(KEY, JSON.stringify(items));
    localStorage.setItem(NAME_KEY, appName);
  }, [items, appName, loaded]);

  // 見本データのまま触っていない状態か（1件でも足す・消すと false になる）
  const isSample = items.length === SAMPLE.length && items.every((i) => i.id.startsWith("s"));

  const counts = useMemo(
    () => ({
      open: items.filter((i) => !i.done).length,
      done: items.filter((i) => i.done).length,
      all: items.length,
    }),
    [items]
  );

  /** 2つ目の統計：日程未定、または7日以上ステータスが動いていないもの */
  const attention = useMemo(() => {
    const open = items.filter((i) => !i.done);
    return open.filter((i) => !i.date || waiting(i.date) >= 7).length;
  }, [items]);

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return items
      .filter((i) => (filter === "all" ? true : filter === "open" ? !i.done : i.done))
      .filter((i) => !k || (i.name + i.term + i.note + i.category).toLowerCase().includes(k))
      .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  }, [items, filter, q]);

  const groups = useMemo(() => grouped(shown, filter), [shown, filter]);

  function resetForm() {
    setForm({ name: "", term: "", category: CATEGORIES[0], note: "", date: "" });
    setEditing(null);
  }

  function save() {
    const name = form.name.trim();
    const term = form.term.trim();
    if (!name || !term) return;
    if (editing) {
      setItems(items.map((i) => (i.id === editing.id ? { ...i, ...form, name, term } : i)));
    } else {
      setItems([...items, { id: String(Date.now()), ...form, name, term, done: false }]);
    }
    resetForm();
    setView("list");
  }

  function startEdit(r: Record) {
    setEditing(r);
    setForm({ name: r.name, term: r.term, category: r.category, note: r.note, date: r.date });
    setView("new");
  }

  const toggle = (id: string) => setItems(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  const remove = (id: string) => setItems(items.filter((i) => i.id !== id));

  const NAV: { k: View; label: string; count?: number }[] = [
    { k: "list", label: "一覧", count: counts.open },
    { k: "new", label: "新規登録" },
    { k: "settings", label: "設定" },
  ];

  const titles: { [K in View]: [string, string] } = {
    list: ["一覧", TEXT.sub],
    new: [editing ? "編集" : "新規登録", "入力して保存すると、一覧に追加されます"],
    settings: ["設定", "表示名の変更と、データの初期化"],
  };

  return (
    <div className="shell" data-tone={TONE} data-density={DENSITY}>
      {/* ───────── 左メニュー ───────── */}
      <nav className="side">
        <div className="side-brand">
          <div className="n">{appName}</div>
          <div className="s">この端末に保存</div>
        </div>
        <div className="side-label">メニュー</div>
        <div className="side-nav">
          {NAV.map((n) => (
            <button
              key={n.k}
              className="side-item"
              aria-current={view === n.k ? "page" : undefined}
              onClick={() => { if (n.k !== "new") resetForm(); setView(n.k); }}
            >
              {n.label}
              {typeof n.count === "number" && <span className="c">{n.count}</span>}
            </button>
          ))}
        </div>
      </nav>

      {/* ───────── 本体 ───────── */}
      <div className="main">
        <header className="topbar">
          <span className="t">{titles[view][0]}</span>
          <span className="d">{titles[view][1]}</span>
          {view === "list" && (
            <span className="right">
              <button className="btn" onClick={() => { resetForm(); setView("new"); }}>新規登録</button>
            </span>
          )}
        </header>

        <div className="content">
          {/* ── 一覧 ── */}
          {view === "list" && (
            <>
              {isSample && (
                <div className="notice">
                  表示中のデータは<b>見本</b>です。そのまま触って試せます。
                  消したいときは、左メニューの<b>設定</b>から。
                </div>
              )}

              <div className="stats">
                <div className="stat"><div className="n accent">{counts.open}</div><div className="l">{TEXT.open}</div></div>
                <div className="stat"><div className="n">{attention}</div><div className="l">{TEXT.stat2}</div></div>
                <div className="stat"><div className="n">{counts.all}</div><div className="l">全{UNIT}</div></div>
              </div>

              <div className="filters">
                <div className="search">
                  <input className="field" value={q} onChange={(e) => setQ(e.target.value)}
                    placeholder="カリキュラム名・メモで検索" />
                </div>
                <div className="seg">
                  {(["open", "done", "all"] as Filter[]).map((f) => (
                    <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                      {f === "open" ? `${TEXT.open} ${counts.open}`
                        : f === "done" ? `${TEXT.done} ${counts.done}`
                        : `全部 ${counts.all}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="list">
                {shown.length === 0 ? (
                  <>
                    <div className="list-head">
                      {filter === "open" ? TEXT.headOpen : filter === "done" ? TEXT.done : "すべて"}
                      <span className="count">0 {UNIT}</span>
                    </div>
                    <div className="empty">
                      <div className="t">{q ? "見つかりませんでした" : "ここに表示するものがありません"}</div>
                      <div className="d">
                        {q ? "検索の言葉を変えてみてください。" : "右上の「新規登録」から追加できます。"}
                      </div>
                    </div>
                  </>
                ) : (
                  groups.map((g) => (
                    <div key={g.key}>
                      <div className={"group-head" + (g.mark ? ` is-${g.mark}` : "")}>
                        {g.mark && <span className="dot" />}
                        {g.label}
                        <span className="count">{g.items.length} {UNIT}</span>
                      </div>
                      {g.items.map((r) => {
                        const b = rowBadge(r);
                        return (
                          <div className="row" key={r.id}>
                            <div className="row-main">
                              <div className="row-title">{r.name}</div>
                              <div className="row-sub">{r.term}{r.note ? ` ・ ${r.note}` : ""}</div>
                            </div>
                            <div className="row-meta">
                              {b && <span className={`badge badge-${b.kind}`}>{b.text}</span>}
                              {!(LAYOUT === "stage" && filter === "open") && (
                                <span className="badge">{r.category}</span>
                              )}
                              {r.date && <span className="row-time">{r.date.slice(5).replace("-", "/")}</span>}
                              <button className="btn-ghost" onClick={() => startEdit(r)}>編集</button>
                              <button className="btn-ghost" onClick={() => toggle(r.id)}>
                                {r.done ? TEXT.toBack : TEXT.toTo}
                              </button>
                              <button className="btn-ghost danger-btn" onClick={() => remove(r.id)}>削除</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
              <p className="note">データはこの端末のブラウザにだけ保存されます。外部には送信されません。</p>
            </>
          )}

          {/* ── 新規登録・編集 ── */}
          {view === "new" && (
            <div className="panel">
              <div className="form-row">
                <label className="label" htmlFor="f-name">カリキュラム名<span className="req">必須</span></label>
                <input id="f-name" className="field" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") save(); }}
                  placeholder="例：経営戦略とマーケティング" />
                <span className="hint">あとで見て、何の講座か分かる書き方にします</span>
              </div>

              <div className="form-row">
                <label className="label" htmlFor="f-term">年度・回<span className="req">必須</span></label>
                <input id="f-term" className="field" value={form.term}
                  onChange={(e) => setForm({ ...form, term: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") save(); }}
                  placeholder="例：2年目 第3回" />
                <span className="hint">4〜5年のうち、何年目・第何回かを書きます</span>
              </div>

              <div className="form-row">
                <div className="inline">
                  <div>
                    <label className="label" htmlFor="f-cat">{TEXT.catLabel}</label>
                    <select id="f-cat" className="select" value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}>
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="f-date">{TEXT.dateLabel}</label>
                    <input id="f-date" className="field" type="date" value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })} />
                    <span className="hint">未定のときは空のままでよい</span>
                  </div>
                </div>
              </div>

              <div className="form-row">
                <label className="label" htmlFor="f-note">理解度メモ</label>
                <textarea id="f-note" className="field" value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="受講後に、理解できた点・復習が必要な点など" />
              </div>

              <div className="form-actions">
                <button className="btn" onClick={save} disabled={!form.name.trim() || !form.term.trim()}>
                  {editing ? "保存する" : "一覧に追加"}
                </button>
                <button className="btn-ghost" onClick={() => { resetForm(); setView("list"); }}>やめる</button>
                <span className="spacer" />
                {editing && (
                  <button className="btn-ghost danger-btn"
                    onClick={() => { remove(editing.id); resetForm(); setView("list"); }}>
                    この1{UNIT}を削除
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── 設定 ── */}
          {view === "settings" && (
            <div className="panel">
              <div className="form-row">
                <label className="label" htmlFor="f-app">画面の表示名</label>
                <input id="f-app" className="field" value={appName}
                  onChange={(e) => setAppName(e.target.value)} />
                <span className="hint">左上に表示されます。変えるとすぐ反映されます</span>
              </div>

              <div className="form-row">
                <label className="label">データ</label>
                <div className="inline">
                  <button className="btn-ghost" onClick={() => setItems(SAMPLE)}>見本データを入れ直す</button>
                  <button className="btn-ghost danger-btn"
                    onClick={() => { if (confirm("全部消します。よろしいですか？")) setItems([]); }}>
                    全部消す
                  </button>
                </div>
                <span className="hint">
                  現在 {counts.all} {UNIT}（{TEXT.open} {counts.open} / {TEXT.done} {counts.done}）
                </span>
              </div>

              <p className="note">
                データはこの端末のブラウザにだけ保存されます。
                別の端末や他の人とは共有されません（共有は第3回で扱います）。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
