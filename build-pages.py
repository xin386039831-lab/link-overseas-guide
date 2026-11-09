# coding: utf-8
"""Generate static reading pages and the topic index; Python 3, no dependencies."""
import html
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent

def asset_version(name):
    return hashlib.sha256((ROOT / name).read_bytes()).hexdigest()[:10]

def esc(value):
    return html.escape(str(value or ''), quote=True)

def load_data():
    raw = (ROOT / 'data.js').read_text(encoding='utf-8')
    return json.loads(raw[raw.index('['):raw.rindex(']') + 1])

def sources(row):
    result, seen = [], set()
    for item in [{'label': row.get('sourceLabel'), 'url': row.get('source')}, *row.get('sources', [])]:
        url = item.get('url', '')
        if urlsplit(url).scheme not in ('https', 'http') or url in seen:
            continue
        result.append(item)
        seen.add(url)
    return result

def page(title, description, body, prefix=''):
    return f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)} · 领客海外</title><meta name="description" content="{esc(description)}"><link rel="stylesheet" href="{prefix}style.css?v={asset_version('style.css')}"></head>
<body><header class="top"><a class="brand" href="{prefix}index.html"><span class="mark">↗</span> 领客海外 · 留学路线指南 <small>LINK OVERSEAS</small></a><a class="toplink" href="{prefix}index.html#explore">探索路线 ↗</a></header>
<main class="reader">{body}</main><footer><div><b>↗ 领客海外 · 留学路线指南</b><p>探索世界，也探索更多可能。</p></div><a href="{prefix}topics.html">主题索引 ↗</a></footer></body></html>'''

def item_list(items, ordered=False):
    tag = 'ol' if ordered else 'ul'
    return f'<{tag}>' + ''.join(f'<li>{esc(item)}</li>' for item in items) + f'</{tag}>'

def build():
    data = load_data()
    index_path = ROOT / 'index.html'
    index_html = index_path.read_text(encoding='utf-8')
    for name in ['style.css', 'data.js', 'app.js']:
        index_html = re.sub(r'(["\x27])' + re.escape(name) + r'(?:\?v=[a-f0-9]+)?(["\x27])',
                            lambda match: match[1] + name + '?v=' + asset_version(name) + match[2], index_html)
    index_path.write_text(index_html, encoding='utf-8')
    routes = ROOT / 'routes'
    routes.mkdir(exist_ok=True)
    expected = set()
    for index, row in enumerate(data):
        ident = row['id']
        if not ident.isdigit():
            raise ValueError(f'Route id must be digits: {ident}')
        filename = f'{ident}.html'
        expected.add(filename)
        all_sources = sources(row)
        source_html = ''.join(f'<li><a href="{esc(source["url"])}" target="_blank" rel="noopener noreferrer">{i}. {esc(source.get("label") or urlsplit(source["url"]).hostname)} ↗</a><small>{esc(source["url"])}</small></li>' for i, source in enumerate(all_sources, 1))
        status = row.get('status', '')
        historical = any(word in status for word in ('停止', '停收', '历史', '已截止', '已关闭'))
        status_html = f'<div class="route-status {"historical" if historical else ""}">{esc(status)}</div>' if status else ''
        facts = f'<h2>关键事实</h2>{item_list(row["facts"])}' if row.get('facts') else ''
        steps = f'<h2>如何申请 / 核对</h2>{item_list(row["steps"], True)}' if row.get('steps') else ''
        previous = data[index - 1] if index > 0 else None
        following = data[index + 1] if index + 1 < len(data) else None
        previous_html = f'<a href="{previous["id"]}.html">← 上一条<br>{esc(previous["title"])}</a>' if previous else '<span></span>'
        following_html = f'<a href="{following["id"]}.html">下一条 →<br>{esc(following["title"])}</a>' if following else '<span></span>'
        body = f'''<nav class="breadcrumb" aria-label="面包屑"><a href="../index.html#explore">← 返回路线筛选</a><a href="../topics.html">主题索引</a></nav>
<div class="section-kicker">ROUTE / {esc(ident)}</div><h1>{esc(row['title'])}</h1>
<div class="tags"><span>{esc(row['country'])}</span><span>{esc(row['stage'])}</span><span>{esc(row['type'])}</span></div>{status_html}
<p class="lead">{esc(row['description'])}</p><div class="budget"><b>费用与资助</b><br>{esc(row['cost'])}</div>
<div class="prose"><h2>申请条件与注意事项</h2><p>{esc(row['details'])}</p>{facts}{steps}</div>
<h2>官方来源与核查记录</h2><p class="verified-date">资料核查：<time datetime="{esc(row.get('verifiedDate'))}">{esc(row.get('verifiedDate'))}</time> · {len(all_sources)} 个来源</p><ol class="source-list">{source_html}</ol>
<div class="note">本条由领客海外依据以上官方公开资料独立整理。金额与申请期按正文注明的年度使用；申请时请核对官方当轮公告及个人资格。录取与资助须分别确认。</div>
<nav class="reader-nav" aria-label="相邻路线">{previous_html}{following_html}</nav>'''
        (routes / filename).write_text(page(row['title'], row['description'], body, '../'), encoding='utf-8')
    for old in routes.glob('*.html'):
        if old.name not in expected:
            old.unlink()
    topic_file = ROOT / 'topics.json'
    if topic_file.exists():
        topics = json.loads(topic_file.read_text(encoding='utf-8'))
        body = '<nav class="breadcrumb"><a href="index.html#explore">← 返回路线筛选</a></nav><div class="section-kicker">THE GUIDE / 主题索引</div><h1>从一个问题，找到一条路。</h1><p class="lead">按职业培训、低学费、公共奖学金和地区资助浏览。一个主题可以包含多条路线；项目已截止或暂停时，条目会说明当前状态。</p>'
        body += '<nav class="topic-jump" aria-label="主题章节">' + ''.join(f'<a href="#section-{esc(section["id"])}">{esc(section["title"])}</a>' for section in topics) + '</nav>'
        count = 0
        for section in topics:
            body += f'<section class="topic-section" id="section-{esc(section["id"])}"><h2>{esc(section["title"])}</h2><ol class="topic-list">'
            for topic in section['topics']:
                matched = [row for row in data if topic['id'] in row.get('auditTopics', [])]
                if not matched:
                    raise ValueError(f'Topic without content: {topic["id"]}')
                count += 1
                links = ''.join(f'<a href="routes/{esc(row["id"])}.html">{esc(row["title"])} ↗</a>' for row in matched)
                body += f'<li><h3>{esc(topic["id"])} / {esc(topic["title"])}</h3>{links}</li>'
            body += '</ol></section>'
        extra = [row for row in data if not row.get('auditTopics')]
        if extra:
            body += '<section class="topic-section"><h2>更多路线与政策</h2><ul class="topic-list">' + ''.join(f'<li><a href="routes/{esc(row["id"])}.html">{esc(row["title"])} ↗</a></li>' for row in extra) + '</ul></section>'
        body += f'<div class="note">{count} 个主题 · {len(data)} 条路线与政策说明。内容核查日期为 2026 年 11 月 7 日。主题范围不等于全球全部项目，更多路线可从首页筛选与搜索。</div>'
        (ROOT / 'topics.html').write_text(page('完整主题索引', '按主题浏览领客海外留学路线与政策说明，每条附官方资料来源。', body), encoding='utf-8')
    print(f'Generated {len(data)} independent route pages and topic index.')

if __name__ == '__main__':
    build()
