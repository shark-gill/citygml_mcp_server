/**
 * CityGML MCP 컨텍스트 포맷터
 * 컨텍스트 정보를 다양한 형식으로 변환합니다.
 */
import { ContextItemType } from './builder.js';
/**
 * 출력 형식 열거형
 */
export var OutputFormat;
(function (OutputFormat) {
    OutputFormat["JSON"] = "json";
    OutputFormat["MARKDOWN"] = "markdown";
    OutputFormat["TEXT"] = "text";
    OutputFormat["HTML"] = "html";
})(OutputFormat || (OutputFormat = {}));
/**
 * 컨텍스트 포맷터 클래스
 */
export class ContextFormatter {
    /**
     * 컨텍스트 포맷팅
     * @param context 컨텍스트 객체
     * @param options 포맷팅 옵션
     * @returns 포맷팅된 문자열
     */
    static format(context, options) {
        // 옵션 기본값 설정
        const opts = {
            format: options.format,
            maxDepth: options.maxDepth ?? 3,
            includeContent: options.includeContent ?? true,
            maxItems: options.maxItems ?? context.items.length,
            compactMode: options.compactMode ?? false,
            highlightKeywords: options.highlightKeywords ?? [],
            codeFormatting: options.codeFormatting ?? true
        };
        // 항목 제한
        const items = context.items.slice(0, opts.maxItems);
        // 출력 형식에 따라 포맷팅
        switch (opts.format) {
            case OutputFormat.JSON:
                return ContextFormatter.formatJSON(context, items, opts);
            case OutputFormat.MARKDOWN:
                return ContextFormatter.formatMarkdown(context, items, opts);
            case OutputFormat.TEXT:
                return ContextFormatter.formatText(context, items, opts);
            case OutputFormat.HTML:
                return ContextFormatter.formatHTML(context, items, opts);
            default:
                return ContextFormatter.formatText(context, items, opts);
        }
    }
    /**
     * JSON 형식으로 변환
     */
    static formatJSON(context, items, options) {
        // 컨텍스트의 깊은 복사본 생성
        const contextCopy = {
            id: context.id,
            query: context.query,
            timestamp: context.timestamp,
            metadata: { ...context.metadata },
            items: []
        };
        // 항목 압축 (필요한 경우)
        for (const item of items) {
            const itemCopy = {
                id: item.id,
                type: item.type,
                name: item.name,
                description: item.description,
                importance: item.importance,
                relevance: item.relevance,
                relatedItems: item.relatedItems
            };
            // 콘텐츠 포함 옵션에 따라 처리
            if (options.includeContent) {
                itemCopy.content = item.content;
            }
            contextCopy.items.push(itemCopy);
        }
        // 간결 모드 적용
        if (options.compactMode) {
            return JSON.stringify(contextCopy);
        }
        else {
            return JSON.stringify(contextCopy, null, 2);
        }
    }
    /**
     * 마크다운 형식으로 변환
     */
    static formatMarkdown(context, items, options) {
        let markdown = `# CityGML 컨텍스트: ${context.id}\n\n`;
        // 메타데이터 추가
        markdown += `## 메타데이터\n\n`;
        markdown += `- **쿼리**: ${context.query || '없음'}\n`;
        markdown += `- **총 항목 수**: ${context.metadata.totalItems}\n`;
        markdown += `- **소스**: ${context.metadata.sources.join(', ')}\n`;
        if (context.metadata.summary) {
            markdown += `- **요약**: ${context.metadata.summary}\n`;
        }
        markdown += `\n## 항목 목록\n\n`;
        // 항목 유형별 그룹화
        const groupedItems = this.groupItemsByType(items);
        // 그룹별 출력
        for (const [type, typeItems] of Object.entries(groupedItems)) {
            markdown += `### ${this.formatItemTypeName(type)}\n\n`;
            for (const item of typeItems) {
                markdown += `#### ${item.name}\n\n`;
                if (item.description) {
                    markdown += `${item.description}\n\n`;
                }
                markdown += `- **ID**: \`${item.id}\`\n`;
                markdown += `- **중요도**: ${item.importance}/10\n`;
                markdown += `- **관련성**: ${(item.relevance * 100).toFixed(1)}%\n`;
                // 관련 항목 정보
                if (item.relatedItems && item.relatedItems.length > 0) {
                    markdown += `- **관련 항목**:\n`;
                    for (const relatedId of item.relatedItems) {
                        const relatedItem = context.items.find(i => i.id === relatedId);
                        if (relatedItem) {
                            markdown += `  - [${relatedItem.name}](#${relatedItem.name.toLowerCase().replace(/\s+/g, '-')})\n`;
                        }
                    }
                    markdown += `\n`;
                }
                // 콘텐츠 포함 여부에 따라 추가 정보 출력
                if (options.includeContent) {
                    markdown += this.formatItemContentMarkdown(item, options);
                }
                markdown += `\n`;
            }
        }
        return markdown;
    }
    /**
     * 텍스트 형식으로 변환
     */
    static formatText(context, items, options) {
        let text = `CityGML 컨텍스트: ${context.id}\n`;
        text += `=`.repeat(text.length) + `\n\n`;
        // 메타데이터 추가
        text += `메타데이터:\n`;
        text += `-`.repeat(10) + `\n`;
        text += `쿼리: ${context.query || '없음'}\n`;
        text += `총 항목 수: ${context.metadata.totalItems}\n`;
        text += `소스: ${context.metadata.sources.join(', ')}\n`;
        if (context.metadata.summary) {
            text += `요약: ${context.metadata.summary}\n`;
        }
        text += `\n항목 목록:\n`;
        text += `-`.repeat(10) + `\n\n`;
        // 항목 유형별 그룹화
        const groupedItems = this.groupItemsByType(items);
        // 그룹별 출력
        for (const [type, typeItems] of Object.entries(groupedItems)) {
            text += `[${this.formatItemTypeName(type)}]\n\n`;
            for (const item of typeItems) {
                text += `${item.name}\n`;
                text += `~`.repeat(item.name.length) + `\n`;
                if (item.description) {
                    text += `${item.description}\n\n`;
                }
                text += `ID: ${item.id}\n`;
                text += `중요도: ${item.importance}/10\n`;
                text += `관련성: ${(item.relevance * 100).toFixed(1)}%\n`;
                // 관련 항목 정보
                if (item.relatedItems && item.relatedItems.length > 0) {
                    text += `관련 항목:\n`;
                    for (const relatedId of item.relatedItems) {
                        const relatedItem = context.items.find(i => i.id === relatedId);
                        if (relatedItem) {
                            text += `  - ${relatedItem.name}\n`;
                        }
                    }
                    text += `\n`;
                }
                // 콘텐츠 포함 여부에 따라 추가 정보 출력
                if (options.includeContent) {
                    text += this.formatItemContentText(item, options);
                }
                text += `\n`;
            }
        }
        return text;
    }
    /**
     * HTML 형식으로 변환
     */
    static formatHTML(context, items, options) {
        let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>CityGML 컨텍스트: ${context.id}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1, h2, h3, h4 { color: #2c3e50; }
    .metadata { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .item { border: 1px solid #e9ecef; padding: 15px; margin-bottom: 15px; border-radius: 5px; }
    .item-title { display: flex; justify-content: space-between; align-items: center; }
    .item-title h3 { margin: 0; }
    .badge { font-size: 0.8em; padding: 3px 7px; border-radius: 3px; background: #e9ecef; }
    .badge-importance { background: #4caf50; color: white; }
    .badge-relevance { background: #2196f3; color: white; }
    .related-items { margin-top: 10px; }
    .related-items a { text-decoration: none; color: #1976d2; }
    .content { margin-top: 15px; border-top: 1px solid #e9ecef; padding-top: 15px; }
    pre { background: #f5f5f5; padding: 10px; overflow: auto; border-radius: 3px; }
    code { font-family: Consolas, monospace; }
    .highlight { background-color: yellow; }
  </style>
</head>
<body>
  <h1>CityGML 컨텍스트: ${context.id}</h1>
  
  <div class="metadata">
    <h2>메타데이터</h2>
    <p><strong>쿼리:</strong> ${context.query || '없음'}</p>
    <p><strong>총 항목 수:</strong> ${context.metadata.totalItems}</p>
    <p><strong>소스:</strong> ${context.metadata.sources.join(', ')}</p>
    ${context.metadata.summary ? `<p><strong>요약:</strong> ${context.metadata.summary}</p>` : ''}
  </div>
  
  <h2>항목 목록</h2>`;
        // 항목 유형별 그룹화
        const groupedItems = this.groupItemsByType(items);
        // 그룹별 출력
        for (const [type, typeItems] of Object.entries(groupedItems)) {
            html += `
  <h3>${this.formatItemTypeName(type)}</h3>
  <div class="items-group">`;
            for (const item of typeItems) {
                const nameWithHighlight = this.highlightKeywords(item.name, options.highlightKeywords);
                const descWithHighlight = item.description ? this.highlightKeywords(item.description, options.highlightKeywords) : '';
                html += `
    <div id="${item.id}" class="item">
      <div class="item-title">
        <h3>${nameWithHighlight}</h3>
        <div>
          <span class="badge badge-importance">중요도: ${item.importance}/10</span>
          <span class="badge badge-relevance">관련성: ${(item.relevance * 100).toFixed(1)}%</span>
        </div>
      </div>
      
      ${descWithHighlight ? `<p>${descWithHighlight}</p>` : ''}
      
      <p><strong>ID:</strong> ${item.id}</p>`;
                // 관련 항목 정보
                if (item.relatedItems && item.relatedItems.length > 0) {
                    html += `
      <div class="related-items">
        <p><strong>관련 항목:</strong></p>
        <ul>`;
                    for (const relatedId of item.relatedItems) {
                        const relatedItem = context.items.find(i => i.id === relatedId);
                        if (relatedItem) {
                            html += `
          <li><a href="#${relatedId}">${relatedItem.name}</a></li>`;
                        }
                    }
                    html += `
        </ul>
      </div>`;
                }
                // 콘텐츠 포함 여부에 따라 추가 정보 출력
                if (options.includeContent) {
                    html += this.formatItemContentHTML(item, options);
                }
                html += `
    </div>`;
            }
            html += `
  </div>`;
        }
        html += `
</body>
</html>`;
        return html;
    }
    /**
     * 항목 타입별 그룹화
     */
    static groupItemsByType(items) {
        const grouped = {};
        for (const item of items) {
            if (!grouped[item.type]) {
                grouped[item.type] = [];
            }
            grouped[item.type].push(item);
        }
        return grouped;
    }
    /**
     * 항목 타입 이름 포맷팅
     */
    static formatItemTypeName(type) {
        switch (type) {
            case ContextItemType.MODULE:
                return '모듈';
            case ContextItemType.CLASS:
                return '클래스';
            case ContextItemType.ATTRIBUTE:
                return '속성';
            case ContextItemType.ASSOCIATION:
                return '관계';
            case ContextItemType.EXAMPLE:
                return '예제';
            case ContextItemType.SCHEMA:
                return '스키마';
            case ContextItemType.ELEMENT:
                return '요소';
            case ContextItemType.TYPE:
                return '타입';
            case ContextItemType.ENCODING_RULE:
                return '인코딩 규칙';
            default:
                return type;
        }
    }
    /**
     * 마크다운에서 항목 콘텐츠 포맷팅
     */
    static formatItemContentMarkdown(item, options) {
        let markdown = '';
        switch (item.type) {
            case ContextItemType.CLASS:
                if (item.content.attributes && item.content.attributes.length > 0) {
                    markdown += `\n**속성:**\n\n`;
                    for (const attrName of item.content.attributes) {
                        markdown += `- ${attrName}\n`;
                    }
                }
                if (item.content.associations && item.content.associations.length > 0) {
                    markdown += `\n**관계:**\n\n`;
                    for (const assocName of item.content.associations) {
                        markdown += `- ${assocName}\n`;
                    }
                }
                break;
            case ContextItemType.EXAMPLE:
                if (item.content.code) {
                    const language = item.content.language?.toLowerCase() || '';
                    markdown += `\n**코드:**\n\n\`\`\`${language}\n${item.content.code}\n\`\`\`\n`;
                }
                break;
            case ContextItemType.ENCODING_RULE:
                if (item.content.appliesTo && item.content.appliesTo.length > 0) {
                    markdown += `\n**적용 대상:**\n\n`;
                    for (const className of item.content.appliesTo) {
                        markdown += `- ${className}\n`;
                    }
                }
                break;
        }
        return markdown;
    }
    /**
     * 텍스트에서 항목 콘텐츠 포맷팅
     */
    static formatItemContentText(item, options) {
        let text = '';
        switch (item.type) {
            case ContextItemType.CLASS:
                if (item.content.attributes && item.content.attributes.length > 0) {
                    text += `\n속성:\n`;
                    for (const attrName of item.content.attributes) {
                        text += `- ${attrName}\n`;
                    }
                }
                if (item.content.associations && item.content.associations.length > 0) {
                    text += `\n관계:\n`;
                    for (const assocName of item.content.associations) {
                        text += `- ${assocName}\n`;
                    }
                }
                break;
            case ContextItemType.EXAMPLE:
                if (item.content.code) {
                    text += `\n코드:\n`;
                    text += `${'='.repeat(40)}\n`;
                    text += `${item.content.code}\n`;
                    text += `${'='.repeat(40)}\n`;
                }
                break;
            case ContextItemType.ENCODING_RULE:
                if (item.content.appliesTo && item.content.appliesTo.length > 0) {
                    text += `\n적용 대상:\n`;
                    for (const className of item.content.appliesTo) {
                        text += `- ${className}\n`;
                    }
                }
                break;
        }
        return text;
    }
    /**
     * HTML에서 항목 콘텐츠 포맷팅
     */
    static formatItemContentHTML(item, options) {
        let html = '';
        switch (item.type) {
            case ContextItemType.CLASS:
                if (item.content.attributes && item.content.attributes.length > 0) {
                    html += `
      <div class="content">
        <h4>속성</h4>
        <ul>`;
                    for (const attrName of item.content.attributes) {
                        const highlighted = this.highlightKeywords(attrName, options.highlightKeywords);
                        html += `
          <li>${highlighted}</li>`;
                    }
                    html += `
        </ul>
      </div>`;
                }
                if (item.content.associations && item.content.associations.length > 0) {
                    html += `
      <div class="content">
        <h4>관계</h4>
        <ul>`;
                    for (const assocName of item.content.associations) {
                        const highlighted = this.highlightKeywords(assocName, options.highlightKeywords);
                        html += `
          <li>${highlighted}</li>`;
                    }
                    html += `
        </ul>
      </div>`;
                }
                break;
            case ContextItemType.EXAMPLE:
                if (item.content.code) {
                    const language = item.content.language?.toLowerCase() || '';
                    const highlighted = this.highlightKeywords(item.content.code, options.highlightKeywords);
                    html += `
      <div class="content">
        <h4>코드 (${language})</h4>
        <pre><code>${highlighted}</code></pre>
      </div>`;
                }
                break;
            case ContextItemType.ENCODING_RULE:
                if (item.content.appliesTo && item.content.appliesTo.length > 0) {
                    html += `
      <div class="content">
        <h4>적용 대상</h4>
        <ul>`;
                    for (const className of item.content.appliesTo) {
                        const highlighted = this.highlightKeywords(className, options.highlightKeywords);
                        html += `
          <li>${highlighted}</li>`;
                    }
                    html += `
        </ul>
      </div>`;
                }
                break;
        }
        return html;
    }
    /**
     * 키워드 강조 처리
     */
    static highlightKeywords(text, keywords) {
        if (!keywords || keywords.length === 0) {
            return text;
        }
        let result = text;
        for (const keyword of keywords) {
            if (!keyword || keyword.trim() === '')
                continue;
            const regex = new RegExp(keyword, 'gi');
            result = result.replace(regex, match => `<span class="highlight">${match}</span>`);
        }
        return result;
    }
    /**
     * 컨텍스트 요약 생성
     * @param context 컨텍스트
     * @param maxLength 최대 길이
     * @returns 요약 문자열
     */
    static generateSummary(context, maxLength = 200) {
        if (!context || context.items.length === 0) {
            return "컨텍스트에 항목이 없습니다.";
        }
        const topItems = context.items.slice(0, 3);
        const itemTypes = [...new Set(context.items.map(item => item.type))];
        let summary = `이 컨텍스트는 ${context.items.length}개의 항목을 포함하고 있으며, `;
        summary += `${this.formatItemTypeList(itemTypes)}에 관한 정보를 담고 있습니다. `;
        if (topItems.length > 0) {
            summary += `가장 관련성 높은 항목은 ${topItems[0].name}`;
            if (topItems[0].type === ContextItemType.CLASS) {
                summary += ` 클래스`;
            }
            else if (topItems[0].type === ContextItemType.MODULE) {
                summary += ` 모듈`;
            }
            summary += `입니다. `;
        }
        // 쿼리가 있는 경우 포함
        if (context.query) {
            summary += `이는 "${context.query}" 쿼리에 대한 응답입니다.`;
        }
        // 최대 길이로 제한
        if (summary.length > maxLength) {
            summary = summary.substring(0, maxLength - 3) + '...';
        }
        return summary;
    }
    /**
     * 항목 타입 목록 포맷팅
     */
    static formatItemTypeList(types) {
        if (!types || types.length === 0) {
            return '';
        }
        const formattedTypes = types.map(type => this.formatItemTypeName(type));
        if (formattedTypes.length === 1) {
            return formattedTypes[0];
        }
        else if (formattedTypes.length === 2) {
            return `${formattedTypes[0]}과 ${formattedTypes[1]}`;
        }
        else {
            const lastType = formattedTypes.pop();
            return `${formattedTypes.join(', ')} 및 ${lastType}`;
        }
    }
}
