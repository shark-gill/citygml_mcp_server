/**
 * CityGML 3.0 인코딩 문서 파서
 */
import * as cheerio from 'cheerio';
import { fetchDocument } from '../utils/http.js';
import { ENCODING_URL, CACHE_TTL } from '../config.js';
import { getMemoryCache, setMemoryCache, getDiskCache, setDiskCache } from '../utils/cache.js';
// 캐시 키
const ENCODING_CACHE_KEY = 'citygml3_encoding';
/**
 * CityGML 3.0 인코딩 문서를 가져와 파싱
 * @returns 파싱된 인코딩 문서
 */
export async function parseEncodingDocument() {
    // 메모리 캐시 확인
    const memCache = getMemoryCache(ENCODING_CACHE_KEY);
    if (memCache) {
        console.log('메모리 캐시에서 인코딩 문서 로드됨');
        return memCache;
    }
    // 디스크 캐시 확인
    const diskCache = getDiskCache(ENCODING_CACHE_KEY);
    if (diskCache) {
        console.log('디스크 캐시에서 인코딩 문서 로드됨');
        setMemoryCache(ENCODING_CACHE_KEY, diskCache, CACHE_TTL.MEMORY);
        return diskCache;
    }
    // 문서 가져오기
    console.log('인코딩 문서 가져오는 중...');
    let html;
    try {
        html = await fetchDocument(ENCODING_URL);
    }
    catch (error) {
        console.error('인코딩 문서를 가져오는 데 실패했습니다.', error);
        // 문서가 없을 경우 기본 문서 생성
        return createDefaultEncodingDocument();
    }
    // Cheerio로 HTML 파싱
    const $ = cheerio.load(html);
    // 기본 문서 정보 추출
    const title = $('title').text().trim() || 'OGC City Geography Markup Language (CityGML) Encoding Standard';
    const version = extractVersion($);
    // 모델 정보 초기화
    const encodingModel = {
        version,
        encodingType: 'GML',
        namespaces: extractNamespaces($),
        encodingRules: extractEncodingRules($),
        examples: extractExamples($)
    };
    // 섹션 정보 추출
    const sections = extractSections($);
    // 결과 문서 생성
    const result = {
        title,
        version,
        url: ENCODING_URL,
        sections,
        model: encodingModel
    };
    // 캐시에 저장
    setMemoryCache(ENCODING_CACHE_KEY, result, CACHE_TTL.MEMORY);
    setDiskCache(ENCODING_CACHE_KEY, result, CACHE_TTL.DISK);
    return result;
}
/**
 * 문서에서 버전 정보 추출
 */
function extractVersion($) {
    // 버전 정보를 포함할 수 있는 여러 위치 확인
    const versionSelectors = [
        '.version',
        'p:contains("Version")',
        'div:contains("Version")',
        'h1:contains("Version")',
        'h2:contains("Version")'
    ];
    for (const selector of versionSelectors) {
        const element = $(selector);
        if (element.length) {
            const text = element.text();
            const match = text.match(/Version\s*[:=]?\s*(\d+\.\d+(?:\.\d+)?)/i);
            if (match && match[1]) {
                return match[1];
            }
        }
    }
    // 기본값 반환
    return '3.0';
}
/**
 * 네임스페이스 정보 추출
 */
function extractNamespaces($) {
    const namespaces = [];
    // 네임스페이스 정보가 있는 테이블 찾기
    $('table').each((_index, table) => {
        const $table = $(table);
        const $rows = $table.find('tr');
        // 헤더에 '네임스페이스' 또는 'prefix' 관련 단어가 있는지 확인
        const $headerRow = $rows.first();
        const headers = $headerRow.find('th, td').map((_i, el) => $(el).text().toLowerCase()).get();
        const prefixIdx = headers.findIndex((h) => h.includes('prefix') || h.includes('namespace') || h.includes('xmlns'));
        const uriIdx = headers.findIndex((h) => h.includes('uri') || h.includes('url') || h.includes('namespace'));
        if (prefixIdx === -1 || uriIdx === -1) {
            return; // 해당 테이블에 네임스페이스 정보가 없음
        }
        // 행을 순회하며 네임스페이스 정보 수집
        $rows.slice(1).each((_i, row) => {
            const $cells = $(row).find('td');
            if ($cells.length <= Math.max(prefixIdx, uriIdx)) {
                return; // 셀 수가 부족함
            }
            const prefix = $cells.eq(prefixIdx).text().trim();
            const uri = $cells.eq(uriIdx).text().trim();
            if (prefix && uri) {
                namespaces.push({
                    prefix,
                    uri
                });
            }
        });
    });
    // 기본 CityGML 네임스페이스가 없는 경우 추가
    if (!namespaces.some(ns => ns.prefix === 'core' || ns.prefix === 'citygml')) {
        namespaces.push({
            prefix: 'citygml',
            uri: 'http://www.opengis.net/citygml/3.0',
            description: 'CityGML 3.0 Core Module'
        });
    }
    return namespaces;
}
/**
 * 인코딩 규칙 추출
 */
function extractEncodingRules($) {
    const rules = [];
    // 'rule', 'encoding', 'requirement' 등의 단어가 있는 제목 찾기
    $('h1, h2, h3, h4, h5').each((_index, heading) => {
        const $heading = $(heading);
        const headingText = $heading.text().toLowerCase();
        if (headingText.includes('rule') ||
            headingText.includes('encoding') ||
            headingText.includes('requirement')) {
            const headingId = $heading.attr('id') || `rule-${rules.length + 1}`;
            const content = extractElementContent($, $heading);
            // 규칙 이름 정제
            const name = $heading.text().trim();
            // 적용 대상 클래스 찾기
            const appliesTo = findClassesInText(content);
            rules.push({
                id: headingId,
                name,
                description: content.substring(0, 300).replace(/<[^>]*>/g, '').trim(),
                appliesTo,
                examples: findExamplesInText(content)
            });
        }
    });
    return rules;
}
/**
 * 텍스트에서 클래스 이름 찾기
 */
function findClassesInText(text) {
    const classNames = new Set();
    // 클래스 이름 패턴 (예: Building, CityModel 등)
    const classPattern = /\b([A-Z][a-zA-Z0-9]*(?:Type|Class|Feature|Object)?)\b/g;
    let match;
    while ((match = classPattern.exec(text)) !== null) {
        const className = match[1];
        // 일반적인 단어 제외
        const commonWords = ['The', 'A', 'An', 'In', 'On', 'Figure', 'Table', 'Section', 'GML', 'XML', 'CityGML'];
        if (!commonWords.includes(className)) {
            classNames.add(className);
        }
    }
    return Array.from(classNames);
}
/**
 * 텍스트에서 예제 코드 참조 찾기
 */
function findExamplesInText(text) {
    const examples = new Set();
    // 예제 참조 패턴 (예: "Example 1", "Listing 2" 등)
    const examplePattern = /\b(?:Example|Listing|Snippet)\s+(\d+)/gi;
    let match;
    while ((match = examplePattern.exec(text)) !== null) {
        examples.add(match[0]);
    }
    return Array.from(examples);
}
/**
 * 예제 코드 추출
 */
function extractExamples($) {
    const examples = [];
    // 코드 블록 추출
    $('pre, code, .listing, .example').each((_index, element) => {
        const $element = $(element);
        const code = $element.text().trim();
        if (code.length < 20) {
            return; // 너무 짧은 코드 블록은 건너뜀
        }
        // 예제 ID 추출
        let id = $element.attr('id') || '';
        if (!id) {
            // 주변 제목에서 ID 추출 시도
            const $heading = $element.prev('h1, h2, h3, h4, h5, h6');
            if ($heading.length) {
                id = $heading.attr('id') || `example-${examples.length + 1}`;
            }
            else {
                id = `example-${examples.length + 1}`;
            }
        }
        // 제목 추출
        let title = '';
        const $heading = $element.prev('h1, h2, h3, h4, h5, h6');
        if ($heading.length) {
            title = $heading.text().trim();
        }
        else {
            // 캡션 확인
            const $figcaption = $element.next('figcaption');
            if ($figcaption.length) {
                title = $figcaption.text().trim();
            }
            else {
                title = `Example ${examples.length + 1}`;
            }
        }
        // 예제 언어 결정
        let language = 'XML';
        if (code.includes('{') && code.includes('}') && !code.includes('<')) {
            language = 'JSON';
        }
        else if (code.includes('SELECT') || code.includes('CREATE TABLE')) {
            language = 'SQL';
        }
        else if (!code.includes('<')) {
            language = 'Other';
        }
        // 관련 클래스 찾기
        const relatedClasses = findClassesInText(code);
        examples.push({
            id,
            title,
            code,
            language,
            relatedClasses
        });
    });
    return examples;
}
/**
 * 문서 섹션 추출
 */
function extractSections($) {
    const sections = [];
    // 상위 수준의 헤딩부터 순회
    $('h1, h2').each((_index, element) => {
        const $heading = $(element);
        const id = $heading.attr('id') || `section-${sections.length + 1}`;
        const title = $heading.text().trim();
        // 상위 수준 섹션 생성
        const section = {
            id,
            title,
            content: extractElementContent($, $heading),
            subsections: extractSubsections($, $heading),
            examples: findExamplesInText(extractElementContent($, $heading)),
            relatedClasses: findClassesInText(extractElementContent($, $heading))
        };
        sections.push(section);
    });
    return sections;
}
/**
 * 하위 섹션 추출
 */
function extractSubsections($, $parentHeading) {
    const subsections = [];
    const parentTagName = $parentHeading.prop('tagName')?.toLowerCase();
    if (parentTagName === 'h1') {
        // h1 다음에 오는 h2 수집
        let $nextEl = $parentHeading.next();
        while ($nextEl.length) {
            if ($nextEl.is('h1')) {
                break;
            }
            if ($nextEl.is('h2')) {
                const id = $nextEl.attr('id') || `subsection-${subsections.length}`;
                const title = $nextEl.text().trim();
                const subsection = {
                    id,
                    title,
                    content: extractElementContent($, $nextEl),
                    examples: findExamplesInText(extractElementContent($, $nextEl)),
                    relatedClasses: findClassesInText(extractElementContent($, $nextEl))
                };
                subsections.push(subsection);
            }
            $nextEl = $nextEl.next();
        }
    }
    else if (parentTagName === 'h2') {
        // h2 다음에 오는 h3 수집
        let $nextEl = $parentHeading.next();
        while ($nextEl.length) {
            if ($nextEl.is('h1') || $nextEl.is('h2')) {
                break;
            }
            if ($nextEl.is('h3')) {
                const id = $nextEl.attr('id') || `subsection-${subsections.length}`;
                const title = $nextEl.text().trim();
                const subsection = {
                    id,
                    title,
                    content: extractElementContent($, $nextEl),
                    examples: findExamplesInText(extractElementContent($, $nextEl)),
                    relatedClasses: findClassesInText(extractElementContent($, $nextEl))
                };
                subsections.push(subsection);
            }
            $nextEl = $nextEl.next();
        }
    }
    return subsections;
}
/**
 * 요소 내용 추출
 */
function extractElementContent($, $element) {
    const tagName = $element.prop('tagName')?.toLowerCase();
    let content = '';
    // 다음 같은 수준의 헤딩을 만날 때까지 내용 수집
    let $nextEl = $element.next();
    while ($nextEl.length) {
        const nextTagName = $nextEl.prop('tagName')?.toLowerCase();
        // 같은 레벨이나 상위 레벨 헤딩을 만나면 종료
        if (nextTagName && ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(nextTagName)) {
            const currentLevel = parseInt(tagName?.substring(1) || '0');
            const nextLevel = parseInt(nextTagName.substring(1));
            if (nextLevel <= currentLevel) {
                break;
            }
        }
        // 내용 추가
        content += $nextEl.toString() + '\n';
        $nextEl = $nextEl.next();
    }
    return content.trim();
}
/**
 * 인코딩 문서를 가져올 수 없을 때 기본 문서 생성
 */
function createDefaultEncodingDocument() {
    // 기본 네임스페이스
    const namespaces = [
        {
            prefix: 'citygml',
            uri: 'http://www.opengis.net/citygml/3.0',
            description: 'CityGML 3.0 Core Module'
        },
        {
            prefix: 'bldg',
            uri: 'http://www.opengis.net/citygml/building/3.0',
            description: 'CityGML 3.0 Building Module'
        },
        {
            prefix: 'tran',
            uri: 'http://www.opengis.net/citygml/transportation/3.0',
            description: 'CityGML 3.0 Transportation Module'
        },
        {
            prefix: 'gml',
            uri: 'http://www.opengis.net/gml/3.2',
            description: 'Geography Markup Language'
        }
    ];
    // 기본 인코딩 규칙
    const encodingRules = [
        {
            id: 'rule-1',
            name: 'GML 인코딩 규칙',
            description: 'CityGML 객체는 GML 3.2를 사용하여 인코딩됩니다.',
            appliesTo: ['AbstractCityObject', 'CityModel'],
            examples: []
        }
    ];
    // 기본 예제
    const examples = [
        {
            id: 'example-1',
            title: 'Building 예제',
            code: '<citygml:CityModel>\n  <citygml:cityObjectMember>\n    <bldg:Building>\n      <gml:name>Example Building</gml:name>\n    </bldg:Building>\n  </citygml:cityObjectMember>\n</citygml:CityModel>',
            language: 'XML',
            relatedClasses: ['CityModel', 'Building']
        }
    ];
    // 기본 모델
    const encodingModel = {
        version: '3.0',
        encodingType: 'GML',
        namespaces,
        encodingRules,
        examples
    };
    // 기본 문서 생성
    return {
        title: 'CityGML 3.0 Encoding Standard',
        version: '3.0',
        url: ENCODING_URL,
        sections: [
            {
                id: 'section-1',
                title: 'Introduction',
                content: 'CityGML 3.0 Encoding Standard에 대한 설명입니다.',
                subsections: []
            },
            {
                id: 'section-2',
                title: 'GML Encoding Rules',
                content: 'CityGML의 GML 인코딩 규칙에 대한 설명입니다.',
                subsections: []
            }
        ],
        model: encodingModel
    };
}
