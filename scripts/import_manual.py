#!/usr/bin/env python3
"""Import the supplied second-hand-car store manual into the Cange knowledge data.

The document has no reliable Word styles.  The article boundaries below are
therefore deliberately explicit: the basic-operation section follows the ten
chapter/subsection boundaries verified in the source, and the strategy section
follows the sixty titles in its table of contents.  The converter keeps source
block numbers so the generated data can be audited and regenerated.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INDEX = ROOT / "qa/manual-import/blocks.json"
DEFAULT_OUTPUT = ROOT / "manual-data.js"
DEFAULT_QA_DIR = ROOT / "qa/manual-import"

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W = f"{{{W_NS}}}"
NS = {"w": W_NS}


# These are the only page-number suffixes found inside otherwise meaningful
# body blocks.  They are source layout artefacts, not document content.
PAGE_MARKERS = {
    208: "0101",
    870: "0101",
    1250: "0101",
    1298: "0101",
    2734: "0202",
    3605: "0202",
    3820: "0202",
    4269: "0202",
    4458: "0202",
    4550: "0202",
}


@dataclass(frozen=True)
class BasicChapter:
    chapter: str
    start: int
    end: int
    sections: tuple[tuple[int, str], ...]


# Explicit chapter and subsection boundaries.  The category is assigned by
# the business meaning of each source subsection, never by keyword matching.
BASIC_CHAPTERS = (
    BasicChapter(
        "一、总则",
        90,
        395,
        (
            (93, "team"),
            (97, "team"),
            (101, "team"),
            (105, "risk"),
            (195, "team"),
            (271, "data"),
        ),
    ),
    BasicChapter(
        "二、岗位职责与薪资绩效",
        396,
        642,
        (
            (400, "team"),
            (403, "team"),
            (496, "team"),
            (515, "team"),
            (622, "team"),
        ),
    ),
    BasicChapter(
        "三、公司优势与核心竞争力",
        643,
        757,
        (
            (647, "marketing"),
            (691, "strategy"),
            (724, "purchase"),
            (732, "delivery"),
            (740, "service"),
            (752, "service"),
        ),
    ),
    BasicChapter(
        "四、车源收购体系",
        758,
        884,
        (
            (760, "purchase"),
            (769, "purchase"),
            (795, "purchase"),
            (835, "risk"),
            (853, "risk"),
        ),
    ),
    BasicChapter(
        "五、销售管理体系",
        885,
        1746,
        (
            (889, "marketing"),
            (907, "sales"),
            (1099, "sales"),
            (1116, "sales"),
            (1322, "delivery"),
            (1350, "sales"),
            (1368, "purchase"),
            (1600, "service"),
            (1689, "service"),
            (1716, "service"),
        ),
    ),
    BasicChapter(
        "八、市场营销与线索获取体系",
        1747,
        1907,
        (
            (1751, "marketing"),
            (1780, "marketing"),
            (1815, "marketing"),
            (1855, "marketing"),
            (1878, "marketing"),
        ),
    ),
    BasicChapter(
        "九、线索管理与客户跟进",
        1908,
        2226,
        (
            (1912, "sales"),
            (1999, "sales"),
            (2057, "sales"),
            (2070, "sales"),
            (2108, "data"),
        ),
    ),
    BasicChapter(
        "十、运营支持与管理系统",
        2227,
        2527,
        (
            (2231, "data"),
            (2259, "data"),
            (2291, "team"),
            (2319, "team"),
            (2419, "team"),
        ),
    ),
    BasicChapter(
        "十一、风险管理与合规经营",
        2528,
        2691,
        (
            (2532, "delivery"),
            (2568, "risk"),
            (2606, "risk"),
            (2646, "risk"),
            (2673, "risk"),
        ),
    ),
    BasicChapter(
        "十二、附则",
        2692,
        2718,
        (
            (2696, "team"),
            (2704, "risk"),
            (2714, "team"),
        ),
    ),
)


# The strategy contents list has two intentionally repeated titles and a
# number of titles split over adjacent Word paragraphs.  Every entry remains
# separate so the source location is visible to the reader and audit.
STRATEGY_ARTICLES = (
    (2724, (2724,), '中国二手车新零售发展的策略与路径', 'strategy'),
    (2780, (2780,), '二手车品牌连锁加盟那点事', 'strategy'),
    (2824, (2824,), '二手车门店颜值革命：环境形象优化全攻略', 'strategy'),
    (2953, (2953, 2954), '靠陈列、布局、装修拉满客户信任，成交率飙升', 'strategy'),
    (3047, (3047,), '二手车新开门店需要解决的问题', 'strategy'),
    (3183, (3183, 3185), '二手车市场的拐点，在于这一批年轻用户的出现', 'strategy'),
    (3213, (3213, 3215), '二手车门店的战略三核心：我服务谁、我是谁、我咋干', 'strategy'),
    (3238, (3238,), '二手车门店运营管理问题诊断思路和步骤', 'data'),
    (3347, (3347,), '二手车门店运营管理诊断的“望闻问切”', 'data'),
    (3396, (3396, 3397), '二手车老板的“冰山生意经”：别只盯着展厅里的车', 'strategy'),
    (3442, (3442,), '差异化营销，跳出二手车价格战陷阱', 'marketing'),
    (3540, (3540,), '二手车门店的N种死法', 'strategy'),
    (3624, (3624,), '二手车门店销售管理存在问题剖析', 'sales'),
    (3642, (3642, 3643), '二手车门店生存战：守不住的存量，必须抢的增量', 'strategy'),
    (3688, (3688,), '二手车门店成本控制与利润提升', 'data'),
    (3723, (3723, 3725), '二手车门店管理：80％的经营困境，源于沟通不畅', 'team'),
    (3754, (3754,), '真正赚钱的二手车门店，一定是“最懂客户”的', 'strategy'),
    (3820, (3820,), '二手车门店老板的“管与不管”', 'team'),
    (3835, (3835,), '二手车门店销售管理存在问题剖析', 'sales'),
    (3859, (3859,), '二手车门店年中总结要点剖析', 'data'),
    (3898, (3898,), '二手车门店如何开好经营分析会', 'data'),
    (3967, (3967,), '二手车门店如何建立自己的金融体系', 'delivery'),
    (4070, (4070,), '二手车门店“草台班子”成功的关键', 'strategy'),
    (4103, (4103,), '成交不是终点，售后才是王道', 'service'),
    (4134, (4134, 4136), '二手车行业正在从“卖车”走向“经营用户全周期信任”', 'service'),
    (4180, (4180,), '亲兄弟明算账，二手车门店分钱的七个原则', 'team'),
    (4236, (4236, 4237), '二手车合伙人模式中，老板需要具备的人格魅力', 'team'),
    (4269, (4269, 4271), '二手车门店老板的拼搏之道：老板为何比员工更努力', 'team'),
    (4299, (4299, 4301), '二手车门店老板决策法则：任何决策都是对的', 'strategy'),
    (4362, (4362, 4364), '二手车门店老板决策力提升的底层逻辑与实战方法论', 'strategy'),
    (4412, (4412,), '二手车门店优秀财务顶门店半边天', 'data'),
    (4480, (4480,), '二手车门店HRBP核心工作内容', 'team'),
    (4534, (4534,), '二手车门店老板的HRBP思维', 'team'),
    (4594, (4594, 4596), '深挖收购数据潜能，驱动二手车业务协同发展', 'data'),
    (4639, (4639,), '二手车门店长库龄车的处置策略', 'data'),
    (4678, (4678,), '二手车市场由“车源为王”向“用户为王”转型', 'strategy'),
    (4691, (4691, 4693), '怎么在二手车整备质量、成本和效率之间找到最优解', 'purchase'),
    (4758, (4758,), '二手车门店老板要学会拒绝无效聚会', 'team'),
    (4815, (4815,), '二手车新媒体千千万，渠道管理是关键', 'marketing'),
    (4901, (4901, 4902), '新媒体时代中小型二手车商如何发挥灵活机动的优势', 'marketing'),
    (4931, (4931,), '二手车门店如何制定各岗位绩效目标', 'team'),
    (4952, (4952,), '关于二手车门店的销售培训', 'sales'),
    (4978, (4978,), '二手车门店别让“扁平化”成了管理陷阱', 'team'),
    (5005, (5005, 5007), '连几个能独当一面的中层都凑不齐，不要谈精细化运营', 'team'),
    (5029, (5029,), '第一性原理视角下，二手车门店的破局与增长', 'strategy'),
    (5066, (5066, 5068), '二手车的短期看政策，中期看趋势，长期看文化', 'strategy'),
    (5092, (5092,), '二手车营销的八个底层逻辑', 'marketing'),
    (5150, (5150,), '二手车门店会员体系搭建', 'service'),
    (5202, (5202,), '二手车门店的二八定律', 'strategy'),
    (5261, (5261,), '二手车人为何总在“唱衰”自己的行业？', 'strategy'),
    (5305, (5305, 5307), '二手车行业别再“向下卷”了！学学刘强东的“向上卷”', 'strategy'),
    (5342, (5342,), '二手车门店如何做好一口价', 'sales'),
    (5411, (5411,), '二手车门店市场营销避坑指南', 'marketing'),
    (5436, (5436,), '二手车门店的中介帮卖利弊分析', 'sales'),
    (5453, (5453,), '二手车门店数据分析内容与重要性', 'data'),
    (5495, (5495, 5498), '有效经营客户让二手车门店在竞争中突出重围', 'service'),
    (5541, (5541, 5543), '二手车门店从“流量”到“留量”的终极漏斗模型', 'marketing'),
    (5611, (5611,), '二手车门店线索分配机制如何公平且高效', 'sales'),
    (5673, (5673,), '现代二手车的竞争拼的是精细化运营的能力', 'strategy'),
    (5697, (5697,), '二手车门店利润倍增：先挥好这四把“快刀”！', 'data'),
)


def text_of(element: ET.Element) -> str:
    """Match the existing block index: concatenate every visible Word text node."""

    return "".join(node.text or "" for node in element.iter(f"{W}t"))


def logical_text_of(element: ET.Element) -> tuple[str, list[dict[str, Any]]]:
    """Read body text once, dropping duplicate modern/fallback shape text.

    The supplied block index intentionally records every ``w:t`` node.  A
    few Word drawings contain the same textbox twice (modern shape plus its
    compatibility fallback), while page numbers appear only in those shapes.
    For rendered content, ordinary paragraph text wins when present; when a
    paragraph consists solely of textboxes, repeated textbox payloads are
    kept once in document order.  The removed payloads are returned for the
    audit instead of being silently discarded.
    """

    textbox_elements = list(element.iter(f"{W}txbxContent"))
    if not textbox_elements:
        return text_of(element), []
    textbox_node_ids = {
        id(node)
        for textbox in textbox_elements
        for node in textbox.iter()
    }
    outside = "".join(
        (node.text or "")
        for node in element.iter(f"{W}t")
        if id(node) not in textbox_node_ids
    )
    textbox_texts = [text_of(textbox) for textbox in textbox_elements]
    cleanup: list[dict[str, Any]] = []
    if outside.strip():
        for textbox_text in textbox_texts:
            if textbox_text:
                cleanup.append(
                    {
                        "removed": textbox_text,
                        "reason": "正文段落已有普通文字，忽略w:txbxContent形状文本以避免布局文本重复",
                    }
                )
        return outside, cleanup

    seen: set[str] = set()
    kept: list[str] = []
    for textbox_text in textbox_texts:
        if not textbox_text:
            continue
        if textbox_text in seen:
            cleanup.append(
                {
                    "removed": textbox_text,
                    "reason": "现代形状与兼容回退形状重复，仅保留一次正文文本",
                }
            )
            continue
        seen.add(textbox_text)
        kept.append(textbox_text)
    return "".join(kept), cleanup


def clean_text(index: int, text: str) -> tuple[str, dict[str, Any] | None]:
    marker = PAGE_MARKERS.get(index)
    if marker is None:
        return text, None
    # Textbox page markers are removed by logical_text_of.  Retain this
    # fallback for a marker that is attached directly to ordinary text.
    if not text.endswith(marker):
        return text, None
    return text[: -len(marker)], {
        "block": index,
        "removed": marker,
        "reason": "Word分页标记粘连在正文段末，不属于正文文字",
    }


def parse_source_blocks(source: Path) -> tuple[list[dict[str, Any]], str]:
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    with zipfile.ZipFile(source) as archive:
        try:
            document_xml = archive.read("word/document.xml")
        except KeyError as exc:
            raise ValueError("DOCX缺少 word/document.xml，无法确认正文结构") from exc
    root = ET.fromstring(document_xml)
    body = root.find(f"{W}body")
    if body is None:
        raise ValueError("DOCX document.xml 缺少 w:body，无法确认正文结构")
    raw: list[dict[str, Any]] = []
    for index, element in enumerate(list(body)):
        tag = element.tag.rsplit("}", 1)[-1]
        index_text = text_of(element)
        logical_text, textbox_cleanup = logical_text_of(element)
        if index in PAGE_MARKERS and not index_text.endswith(PAGE_MARKERS[index]):
            raise ValueError(
                f"configured page marker {PAGE_MARKERS[index]!r} is absent at raw block {index}"
            )
        for cleanup in textbox_cleanup:
            cleanup["block"] = index
            if index in PAGE_MARKERS and cleanup["removed"] in PAGE_MARKERS[index]:
                cleanup["reason"] = "Word分页标记位于w:txbxContent形状中，不属于正文文字"
        raw.append(
            {
                "i": index,
                "tag": "tbl" if tag == "tbl" else ("sectPr" if tag == "sectPr" else "p"),
                "indexText": index_text,
                "text": logical_text,
                "textboxCleanup": textbox_cleanup,
                "element": element,
            }
        )
    return raw, digest


def verify_index(raw: list[dict[str, Any]], index_path: Path) -> None:
    expected = json.loads(index_path.read_text(encoding="utf-8"))
    if not isinstance(expected, list):
        raise ValueError("blocks.json 不是顶层数组，无法核对源块")
    if len(expected) != len(raw):
        raise ValueError(f"blocks.json 块数 {len(expected)} 与 DOCX {len(raw)} 不一致")
    mismatches = []
    for actual, known in zip(raw, expected):
        if actual["tag"] != known.get("tag") or actual["indexText"] != known.get("text", ""):
            mismatches.append(actual["i"])
            if len(mismatches) >= 10:
                break
    if mismatches:
        raise ValueError(f"blocks.json 与 DOCX 顶层块不一致，首个块: {mismatches}")


def cell_span(cell: ET.Element, name: str) -> int | None:
    tc_pr = cell.find(f"{W}tcPr")
    if tc_pr is None:
        return None
    node = tc_pr.find(f"{W}{name}")
    if node is None:
        return None
    value = node.get(f"{W}val") or node.get("val")
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def parse_table(element: ET.Element) -> list[list[dict[str, Any]]]:
    """Return rows with colspan/rowspan metadata suitable for HTML rendering."""

    rows: list[list[dict[str, Any]]] = []
    active_rowspans: dict[int, dict[str, Any]] = {}
    for row_index, row in enumerate(element.findall(f"{W}tr")):
        output_row: list[dict[str, Any]] = []
        column = 0
        for cell in row.findall(f"{W}tc"):
            colspan = cell_span(cell, "gridSpan") or 1
            tc_pr = cell.find(f"{W}tcPr")
            merge = tc_pr.find(f"{W}vMerge") if tc_pr is not None else None
            merge_value = None if merge is None else (merge.get(f"{W}val") or merge.get("val"))
            if merge is not None and merge_value is None:
                previous = active_rowspans.get(column)
                if previous is not None:
                    previous["rowspan"] = int(previous.get("rowspan", 1)) + 1
                column += colspan
                continue
            cell_data: dict[str, Any] = {"text": logical_text_of(cell)[0]}
            if colspan > 1:
                cell_data["colspan"] = colspan
            if merge is not None and merge_value == "restart":
                cell_data["rowspan"] = 1
                for offset in range(colspan):
                    active_rowspans[column + offset] = cell_data
            else:
                for offset in range(colspan):
                    active_rowspans.pop(column + offset, None)
            output_row.append(cell_data)
            column += colspan
        rows.append(output_row)
    # Omit the default rowspan=1 to keep the generated data compact.
    for row in rows:
        for cell in row:
            if cell.get("rowspan") == 1:
                cell.pop("rowspan", None)
    return rows


def clean_title_parts(raw: list[dict[str, Any]], indices: Iterable[int]) -> str:
    parts = []
    for index in indices:
        text, _ = clean_text(index, raw[index]["text"])
        parts.append(text)
    return "".join(parts)


def js_safe(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)


def source_block_text(block: dict[str, Any]) -> str:
    if block["tag"] == "tbl":
        return "".join(
            cell["text"]
            for row in parse_table(block["element"])
            for cell in row
        )
    return block["text"]


def compact_ranges(numbers: Iterable[int]) -> list[list[int]]:
    values = sorted(set(numbers))
    if not values:
        return []
    ranges: list[list[int]] = []
    start = previous = values[0]
    for value in values[1:]:
        if value == previous + 1:
            previous = value
            continue
        ranges.append([start, previous])
        start = previous = value
    ranges.append([start, previous])
    return ranges


def normalised_for_compare(text: str) -> str:
    return re.sub(r"\s+", "", text)


def article_blocks(
    raw: list[dict[str, Any]],
    start: int,
    end: int,
    title_indices: tuple[int, ...],
    chapter_index: int | None = None,
    nested_heading_indices: set[int] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Create display blocks and page-marker exclusion records for one article."""

    title_set = set(title_indices)
    heading_set = set(title_indices)
    if chapter_index is not None:
        heading_set.add(chapter_index)
    if nested_heading_indices:
        heading_set.update(nested_heading_indices)
    output: list[dict[str, Any]] = []
    removals: list[dict[str, Any]] = []
    # A split heading is one logical heading while both source blocks stay in
    # its source range and in the coverage audit.  Emit it at its first source
    # position so the generated text remains in exact document order.
    title_start = min(title_indices) if title_indices else None
    title_text = clean_title_parts(raw, title_indices) if title_indices else ""
    for index in range(start, end + 1):
        removals.extend(raw[index].get("textboxCleanup", []))
        if title_start is not None and index == title_start:
            output.append({"type": "heading", "level": 3, "text": title_text})
        if index in title_set:
            continue
        block = raw[index]
        if block["tag"] == "sectPr" or not block["text"].strip():
            continue
        if block["tag"] == "tbl":
            output.append({"type": "table", "rows": parse_table(block["element"])})
            continue
        text, removal = clean_text(index, block["text"])
        if removal:
            removals.append(removal)
        if not text.strip():
            continue
        output.append(
            {
                "type": "heading" if index in heading_set else "paragraph",
                **({"level": 3} if index in heading_set else {}),
                "text": text,
            }
        )
    return output, removals


def first_description(blocks: list[dict[str, Any]], title: str) -> str:
    for block in blocks:
        if block["type"] == "paragraph" and block.get("text", "").strip():
            text = block["text"].strip()
            return text[:140]
    return title[:140]


def article_minutes(blocks: list[dict[str, Any]]) -> int:
    count = 0
    for block in blocks:
        if block["type"] == "table":
            count += sum(len(cell["text"]) for row in block["rows"] for cell in row)
        else:
            count += len(block.get("text", ""))
    return max(1, math.ceil(count / 450))


def build_articles(raw: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    articles: list[dict[str, Any]] = []
    page_removals: list[dict[str, Any]] = []
    basic_number = 0
    for chapter in BASIC_CHAPTERS:
        for section_index, category in chapter.sections:
            basic_number += 1
            next_indices = [idx for idx, _ in chapter.sections if idx > section_index]
            end = (next_indices[0] - 1) if next_indices else chapter.end
            title, title_removal = clean_text(section_index, raw[section_index]["text"])
            if title_removal:
                page_removals.append(title_removal)
            blocks, removals = article_blocks(
                raw,
                chapter.start if section_index == chapter.sections[0][0] else section_index,
                end,
                (section_index,),
                chapter_index=chapter.start if section_index == chapter.sections[0][0] else None,
            )
            page_removals.extend(removals)
            article = {
                "id": f"manual-basic-{basic_number:03d}",
                "cat": category,
                "title": title,
                "desc": first_description(blocks, title),
                "type": "手册原文",
                "minutes": article_minutes(blocks),
                "source": {
                    "title": "二手车门店标准化运营手册",
                    "part": "基础运营篇",
                    "chapter": chapter.chapter,
                    "blockStart": chapter.start if section_index == chapter.sections[0][0] else section_index,
                    "blockEnd": end,
                },
                "blocks": blocks,
            }
            articles.append(article)

    strategy_starts = [start for start, _, _, _ in STRATEGY_ARTICLES]
    duplicate_title_count: dict[str, int] = {}
    for strategy_number, (start, title_indices, expected_title, category) in enumerate(STRATEGY_ARTICLES, 1):
        next_starts = [candidate for candidate in strategy_starts if candidate > start]
        end = (next_starts[0] - 1) if next_starts else 5723
        actual_title = clean_title_parts(raw, title_indices)
        if actual_title != expected_title:
            raise ValueError(
                f"策略标题与显式映射不一致: {start}: {actual_title!r} != {expected_title!r}"
            )
        blocks, removals = article_blocks(raw, start, end, title_indices)
        page_removals.extend(removals)
        source: dict[str, Any] = {
            "title": "二手车门店标准化运营手册",
            "part": "运营策略篇",
            "chapter": "运营策略篇",
            "blockStart": start,
            "blockEnd": end,
        }
        duplicate_title_count[actual_title] = duplicate_title_count.get(actual_title, 0) + 1
        original_title = actual_title
        display_title = actual_title
        if actual_title == "二手车门店销售管理存在问题剖析":
            occurrence = duplicate_title_count[actual_title]
            display_title = f"原文第{occurrence}篇：{actual_title}"
            source["originalTitle"] = original_title
        article = {
            "id": f"manual-strategy-{strategy_number:03d}",
            "cat": category,
            "title": display_title,
            "desc": first_description(blocks, display_title),
            "type": "运营策略",
            "minutes": article_minutes(blocks),
            "source": source,
            "blocks": blocks,
        }
        articles.append(article)
    # The appendix lists common form names but does not contain form files.
    appendix = next(article for article in articles if article["source"]["blockStart"] == 2714)
    appendix["source"]["note"] = "原文仅列出常用表单名称，未附具体模板；本导入不虚构模板内容。"
    return articles, page_removals


def flatten_article_text(articles: list[dict[str, Any]]) -> str:
    parts: list[str] = []
    for article in articles:
        for block in article["blocks"]:
            if block["type"] == "table":
                parts.extend(cell["text"] for row in block["rows"] for cell in row)
            else:
                parts.append(block["text"])
    return "".join(parts)


def output_js(articles: list[dict[str, Any]], meta: dict[str, Any]) -> str:
    return (
        "'use strict';\n\n"
        f"const MANUAL_ARTICLES={js_safe(articles)};\n\n"
        f"const MANUAL_META={js_safe(meta)};\n\n"
        "if(typeof module!=='undefined') module.exports={MANUAL_ARTICLES,MANUAL_META};\n"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True, help="DOCX source path (explicitly required)")
    parser.add_argument("--index", type=Path, default=DEFAULT_INDEX, help="pre-extracted block index")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="generated JS data path")
    parser.add_argument("--qa-dir", type=Path, default=DEFAULT_QA_DIR, help="audit output directory")
    args = parser.parse_args()

    source = args.source
    if not source.exists():
        raise FileNotFoundError(f"找不到授权 DOCX: {source}")
    raw, sha256 = parse_source_blocks(source)
    if args.index.exists():
        verify_index(raw, args.index)
    articles, page_removals = build_articles(raw)
    drawing_count = sum(
        sum(1 for _ in block["element"].iter(f"{W}drawing"))
        for block in raw
    )
    textbox_block_ids = sorted(
        block["i"]
        for block in raw
        if list(block["element"].iter(f"{W}txbxContent"))
    )
    textbox_count = sum(
        sum(1 for _ in block["element"].iter(f"{W}txbxContent"))
        for block in raw
    )
    textbox_duplicate_blocks = sorted(
        {
            item["block"]
            for block in raw
            for item in block.get("textboxCleanup", [])
            if "重复" in item["reason"]
        }
    )
    textbox_page_marker_blocks = sorted(set(PAGE_MARKERS).intersection(textbox_block_ids))
    textbox_cleanup_count = sum(len(block.get("textboxCleanup", [])) for block in raw)

    body_ranges = [(90, 2718), (2724, 5723)]
    covered_source = set()
    for article in articles:
        covered_source.update(range(article["source"]["blockStart"], article["source"]["blockEnd"] + 1))
    blank_body = [
        block["i"]
        for block in raw
        if any(lo <= block["i"] <= hi for lo, hi in body_ranges)
        and (block["tag"] == "sectPr" or not block["text"].strip())
    ]
    nonempty_body = {
        block["i"]
        for block in raw
        if any(lo <= block["i"] <= hi for lo, hi in body_ranges)
        and block["tag"] != "sectPr"
        and block["text"].strip()
    }
    unassigned = sorted(nonempty_body - covered_source)
    cleaned_source = "".join(
        clean_text(block["i"], source_block_text(block))[0]
        for block in raw
        if block["i"] in covered_source and block["tag"] != "sectPr" and block["text"].strip()
    )
    generated_text = flatten_article_text(articles)
    text_match = normalised_for_compare(cleaned_source) == normalised_for_compare(generated_text)
    tables = [block["i"] for block in raw if block["tag"] == "tbl"]
    table_output_count = sum(
        1
        for article in articles
        for block in article["blocks"]
        if block["type"] == "table"
    )
    empty_articles = [article["id"] for article in articles if not article["blocks"]]
    ids = [article["id"] for article in articles]
    category_map = [
        {
            "id": article["id"],
            "cat": article["cat"],
            "title": article["title"],
            "type": article["type"],
            "source": article["source"],
        }
        for article in articles
    ]

    exclusions = {
        "sourcePathRequested": str(source),
        "sourcePathUsed": str(source),
        "entries": [
            {"range": [0, 84], "reason": "目录、目录页码及篇章页，不属于正文"},
            {"range": [85, 89], "reason": "基础运营篇前置篇章页与装饰空白；正文从块90开始"},
            {"range": [2719, 2723], "reason": "运营策略篇前置篇章页与装饰空白；正文从块2724开始"},
            {"ranges": compact_ranges(blank_body), "reason": "空白段落或DOCX文档终止块，不含正文文字"},
            *page_removals,
        ],
    }
    meta = {
        "title": "二手车门店标准化运营手册",
        "fileName": source.name,
        "sha256": sha256,
        "sourceBytes": source.stat().st_size,
        "sourceBlockCount": len(raw),
        "bodyBlockRanges": body_ranges,
        "articleCount": len(articles),
        "basicArticleCount": sum(1 for article in articles if article["type"] == "手册原文"),
        "strategyArticleCount": sum(1 for article in articles if article["type"] == "运营策略"),
        "categoryCounts": {
            category: sum(1 for article in articles if article["cat"] == category)
            for category in sorted({article["cat"] for article in articles})
        },
        "tableCount": len(tables),
        "tableBlockIds": tables,
        "ooxmlStructure": {
            "drawingCount": drawing_count,
            "textboxCount": textbox_count,
            "textboxBlockCount": len(textbox_block_ids),
            "textboxBlockIds": textbox_block_ids,
            "textboxDuplicateBlocks": textbox_duplicate_blocks,
            "textboxPageMarkerBlocks": textbox_page_marker_blocks,
            "textboxCleanupRecords": textbox_cleanup_count,
        },
        "bodyTextCharsAfterLayoutCleanup": len(cleaned_source),
        "generatedTextChars": len(generated_text),
        "coverage": {
            "nonemptyBodyBlocks": len(nonempty_body),
            "coveredBodyBlocks": len(nonempty_body - set(unassigned)),
            "unassignedNonemptyBlocks": unassigned,
            "textMatch": text_match,
        },
    }
    audit = {
        "status": "PASS"
        if text_match
        and not unassigned
        and not empty_articles
        and len(tables) == 6
        and table_output_count == 6
        and len(ids) == len(set(ids))
        and len(articles) == 115
        else "FAIL",
        "source": {
            "requestedPath": str(source),
            "usedPath": str(source),
            "requestedPathExists": source.exists(),
            "sha256": sha256,
            "bytes": source.stat().st_size,
            "indexPath": str(args.index),
            "sourceIndexExactMatch": True if args.index.exists() else None,
        },
        "articleCount": len(articles),
        "expectedArticleCount": 115,
        "allArticlesNonEmpty": not empty_articles,
        "emptyArticles": empty_articles,
        "titleAndSourceRanges": all(
            article["title"]
            and article["source"]["blockStart"] <= article["source"]["blockEnd"]
            for article in articles
        ),
        "duplicateTitlesPreserved": sum(
            1
            for article in articles
            if article["source"].get("originalTitle") == "二手车门店销售管理存在问题剖析"
        )
        == 2
        and all(
            article["title"].startswith("原文第")
            for article in articles
            if article["source"].get("originalTitle") == "二手车门店销售管理存在问题剖析"
        ),
        "tableCount": len(tables),
        "tableBlockIds": tables,
        "tableOutputCount": table_output_count,
        "ooxmlStructure": {
            "drawingCount": drawing_count,
            "textboxCount": textbox_count,
            "textboxBlockCount": len(textbox_block_ids),
            "textboxBlockIds": textbox_block_ids,
            "textboxDuplicateBlocks": textbox_duplicate_blocks,
            "textboxPageMarkerBlocks": textbox_page_marker_blocks,
            "textboxCleanupRecords": textbox_cleanup_count,
            "textboxDeduplicated": bool(textbox_duplicate_blocks),
        },
        "bodyCoverage": {
            "nonemptyBodyBlocks": len(nonempty_body),
            "coveredBodyBlocks": len(nonempty_body - set(unassigned)),
            "coverageRatio": round((len(nonempty_body - set(unassigned)) / len(nonempty_body)) if nonempty_body else 1, 6),
            "unassignedNonemptyBlocks": unassigned,
            "textMatch": text_match,
            "sourceTextChars": len(cleaned_source),
            "generatedTextChars": len(generated_text),
        },
        "categoryMapping": category_map,
        "exclusionsPath": str(args.qa_dir / "exclusions.json"),
        "typeSafeCalled": False,
        "typeSafeNote": "未调用 TypeSafe：TYPESAFE_API_KEY 缺失，分类使用人工显式映射。",
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.qa_dir.mkdir(parents=True, exist_ok=True)
    args.output.write_text(output_js(articles, meta), encoding="utf-8")
    (args.qa_dir / "audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (args.qa_dir / "exclusions.json").write_text(json.dumps(exclusions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (args.qa_dir / "category-map.json").write_text(json.dumps(category_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": audit["status"], "output": str(args.output), "audit": str(args.qa_dir / "audit.json"), "articles": len(articles), "source": str(source)}, ensure_ascii=False))
    return 0 if audit["status"] == "PASS" else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (FileNotFoundError, ValueError, zipfile.BadZipFile, ET.ParseError) as exc:
        print(f"import_manual.py: ERROR: {exc}", file=sys.stderr)
        raise SystemExit(2)
