// ─────────────────────────────────────────────────────────
// これは「業務アプリの画面」です。宣伝ページ（LP）ではありません。
//
// 中小企業診断士の受講記録管理ツール。
// 左メニュー（.side）＋ 上部バー（.topbar）＋ 本体（.content）
// 一覧 / 新規登録 / 設定 の3画面を view で切り替える
// ─────────────────────────────────────────────────────────
"use client";

import { useEffect, useMemo, useState } from "react";

// ═══════════════════════════════════════════════════════════
//  画面の型 ── docs/03_spec.md の「0. 画面の型」に合わせて設定
// ═══════════════════════════════════════════════════════════

/** 色み。士業・BtoB */
const TONE = "indigo";

/** 密度。年1回・少数の科目で、1件が重い（多日程の研修） */
const DENSITY = "roomy";

/** 画面の型。「どこまで進んだか」を段階で束ねる */
const LAYOUT: "queue" | "stage" | "due" = "stage";

/** 数え方 */
const UNIT = "科目";

/** 段階の選択肢（「受講済み」は done フラグで表す） */
const CATEGORIES = ["未受講", "受講予定"];

// ═══════════════════════════════════════════════════════════

/** 1件のデータ（1科目） */
type Record = {
  id: string;
  name: string;           // 科目名
  category: string;       // 段階（未受講 / 受講予定）
  note: string;            // メモ
  date: string;            // YYYY-MM-DD（受講予定日／受講日）
  understanding: string;   // 理解度（未評価 / ◎ / ○ / △）
  done: boolean;           // 受講済みか
};

type View = "list" | "new" | "settings";
type Filter = "open" | "done" | "all";

const KEY = "shindanshi-curriculum";
const NAME_KEY = "shindanshi-appname";

const UNDERSTANDING_OPTIONS = ["未評価", "◎", "○", "△"];

/** 画面の型ごとの言葉。ここを直せば画面じゅうの文言が揃って変わる */
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
    sub: "科目ごとの進み具合が、段階で分かります",
    open: "受講前", done: "受講済み",
    toTo: "受講済みにする", toBack: "受講前に戻す",
    dateLabel: "受講（予定）日", catLabel: "進み具合",
    stat2: "予定日を過ぎている",
    headOpen: "受講前",
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

/** 何日待たせているか（"queue" / "stage" 用） */
const waiting = (d: string) => Math.max(0, -diff(d));

/** 段階が7日/30日以上動いていないと見なす日数の境目 */
const ATTENTION_LIMIT = LAYOUT === "stage" ? 30 : 3;

/**
 * 見本データ。実在の人名・連絡先は使わない。
 * 中小企業診断士の実務補習・研修カリキュラムを想定した架空の科目名。
 */
const SAMPLE: Record[] = [
  { id: "s01", name: "経営戦略論",         category: "未受講", note: "SWOTとPPMの実務適用がよく理解できた", date: ago(400), understanding: "◎", done: true },
  { id: "s02", name: "財務会計",           category: "未受講", note: "簿記の復習が必要",                     date: ago(380), understanding: "○", done: true },
  { id: "s03", name: "マーケティング戦略", category: "未受講", note: "STP分析の事例を再確認したい",           date: ago(350), understanding: "◎", done: true },
  { id: "s04", name: "経営情報システム",   category: "未受講", note: "ITベンダー選定の評価軸が曖昧なまま終わった", date: ago(30), understanding: "△", done: true },
  { id: "s05", name: "中小企業政策",       category: "未受講", note: "補助金制度の一覧を作った",             date: ago(20), understanding: "○", done: true },
  { id: "s06", name: "生産管理",           category: "受講予定", note: "工場見学の日程を確認する",           date: ago(-14), understanding: "未評価", done: false },
  { id: "s07", name: "店舗診断実習",       category: "受講予定", note: "商店街の実習先が決まった",           date: ago(-30), understanding: "未評価", done: false },
  { id: "s08", name: "組織・人事管理",     category: "受講予定", note: "人事評価制度の設計演習がある",       date: ago(-60), understanding: "未評価", done: false },
  { id: "s09", name: "創業支援実務",       category: "受講予定", note: "予定日が過ぎている。日程を確認する", date: ago(45), understanding: "未評価", done: false },
  { id: "s10", name: "生産性向上支援",     category: "未受講", note: "3年目カリキュラムの候補",             date: ago(-120), understanding: "未評価", done: false },
  { id: "s11", name: "事業承継支援",       category: "未受講", note: "4年目に開講予定と聞いている",         date: ago(-200), understanding: "未評価", done: false },
  { id: "s12", name: "IT利活用支援",       category: "未受講", note: "",                                     date: ago(-250), understanding: "未評価", done: false },
  { id: "s13", name: "農業経営診断",       category: "未受講", note: "選択科目。履修するか検討中",           date: ago(-300), understanding: "未評価", done: false },
  { id: "s14", name: "補助金活用支援",     category: "未受講", note: "申請書の演習があるらしい",             date: ago(-90), understanding: "未評価", done: false },
];

/** 一覧をどう束ねるか。LAYOUT ごとに変わる */
type Group = { key: string; label: string; mark?: "late" | "now"; items: Record[] };

function grouped(list: Record[], filter: Filter): Group[] {
  const head = filter === "open" ? TEXT.headOpen : filter === "done" ? TEXT.done : "すべて";

  if (LAYOUT === "stage" && filter === "open") {
    // 段階ごとに束ねる。CATEGORIES の順に並べ、中身が無い段階は出さない
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

/** 行の右に出す小さなバッジ。LAYOUT ごとに意味が変わる */
function rowBadge(r: Record): { text: string; kind: "warn" | "danger" } | null {
  if (r.done) return null;
  if (LAYOUT === "due") {
    const d = diff(r.date);
    if (d < 0) return { text: `${-d}日 超過`, kind: "danger" };
    if (d === 0) return { text: "今日", kind: "warn" };
    return null;
  }
  const w = waiting(r.date);
  return w >= ATTENTION_LIMIT ? { text: `${w}日 経過`, kind: "warn" } : null;
}

/** 理解度に応じたバッジの色 */
function understandingClass(u: string): string {
  if (u === "◎") return "badge-ok";
  if (u === "△") return "badge-warn";
  return "";
}

export default function Home() {
  const [items, setItems] = useState<Record[]>([]);
  const [appName, setAppName] = useState("受講記録");
  const [loaded, setLoaded] = useState(false);

  const [view, setView] = useState<View>("list");
  const [filter, setFilter] = useState<Filter>("open");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Record | null>(null);

  const [form, setForm] = useState({
    name: "", category: CATEGORIES[0], note: "", date: today(), understanding: UNDERSTANDING_OPTIONS[0],
  });

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

  /** 2つ目の統計。予定日を過ぎているのに、まだ受講済みにしていない科目の数 */
  const attention = useMemo(() => {
    const open = items.filter((i) => !i.done);
    return open.filter((i) => waiting(i.date) >= ATTENTION_LIMIT).length;
  }, [items]);

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return items
      .filter((i) => (filter === "all" ? true : filter === "open" ? !i.done : i.done))
      .filter((i) => !k || (i.name + i.note + i.category).toLowerCase().includes(k))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [items, filter, q]);

  const groups = useMemo(() => grouped(shown, filter), [shown, filter]);

  function resetForm() {
    setForm({ name: "", category: CATEGORIES[0], note: "", date: today(), understanding: UNDERSTANDING_OPTIONS[0] });
    setEditing(null);
  }

  function save() {
    const name = form.name.trim();
    if (!name) return;
    if (editing) {
      setItems(items.map((i) => (i.id === editing.id ? { ...i, ...form, name } : i)));
    } else {
      setItems([...items, { id: String(Date.now()), ...form, name, done: false }]);
    }
    resetForm();
    setView("list");
  }

  function startEdit(r: Record) {
    setEditing(r);
    setForm({ name: r.name, category: r.category, note: r.note, date: r.date, understanding: r.understanding });
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
        <div className="side-foot">設定からいつでも初期化できます</div>
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
                    placeholder="科目名・メモで検索" />
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
                      <div className="t">{q ? "見つかりませんでした" : "ここに表示する科目がありません"}</div>
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
                              {r.note && <div className="row-sub">{r.note}</div>}
                            </div>
                            <div className="row-meta">
                              {b && <span className={`badge badge-${b.kind}`}>{b.text}</span>}
                              {r.done ? (
                                <span className={`badge ${understandingClass(r.understanding)}`}>
                                  理解度 {r.understanding}
                                </span>
                              ) : (
                                !(LAYOUT === "stage" && filter === "open") && (
                                  <span className="badge">{r.category}</span>
                                )
                              )}
                              <span className="row-time">{r.date.slice(2).replace(/-/g, "/")}</span>
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
                <label className="label" htmlFor="f-name">科目名<span className="req">必須</span></label>
                <input id="f-name" className="field" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") save(); }}
                  placeholder="例：経営戦略論" />
                <span className="hint">研修や実務補習のカリキュラム表に出てくる名前で</span>
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
                  </div>
                </div>
              </div>

              <div className="form-row">
                <label className="label" htmlFor="f-understanding">理解度（受講後に記録）</label>
                <select id="f-understanding" className="select" value={form.understanding}
                  onChange={(e) => setForm({ ...form, understanding: e.target.value })}>
                  {UNDERSTANDING_OPTIONS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>

              <div className="form-row">
                <label className="label" htmlFor="f-note">メモ</label>
                <textarea id="f-note" className="field" value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="復習ポイント・気づきなど" />
              </div>

              <div className="form-actions">
                <button className="btn" onClick={save} disabled={!form.name.trim()}>
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
