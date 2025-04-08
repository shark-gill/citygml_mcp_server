/**
 * CityGML 3.0 개념 모델 문서 파서
 */
import * as cheerio from 'cheerio';
import { fetchDocument } from '../utils/http.js';
import { CONCEPT_MODEL_URL, CACHE_TTL } from '../config.js';
import { getMemoryCache, setMemoryCache, getDiskCache, setDiskCache } from '../utils/cache.js';
// 캐시 키
const CONCEPT_MODEL_CACHE_KEY = 'citygml3_concept_model';
/**
 * CityGML 3.0 개념 모델 문서를 가져와 파싱
 * @returns 파싱된 개념 모델 문서
 */
export async function parseConceptModel() {
    // 메모리 캐시 확인
    const memCache = getMemoryCache(CONCEPT_MODEL_CACHE_KEY);
    if (memCache) {
        console.log('메모리 캐시에서 개념 모델 로드됨');
        return memCache;
    }
    // 디스크 캐시 확인
    const diskCache = getDiskCache(CONCEPT_MODEL_CACHE_KEY);
    if (diskCache) {
        console.log('디스크 캐시에서 개념 모델 로드됨');
        setMemoryCache(CONCEPT_MODEL_CACHE_KEY, diskCache, CACHE_TTL.MEMORY);
        return diskCache;
    }
    // 문서 가져오기
    console.log('개념 모델 문서 가져오는 중...');
    const html = await fetchDocument(CONCEPT_MODEL_URL);
    // Cheerio로 HTML 파싱
    const $ = cheerio.load(html);
    // 기본 문서 정보 추출
    const title = $('title').text().trim() || 'OGC City Geography Markup Language (CityGML)';
    const version = extractVersion($);
    // 모델 정보 초기화
    const conceptualModel = {
        version,
        modules: []
    };
    // 섹션 정보 추출
    const sections = extractSections($);
    // 다이어그램 추출
    const diagrams = extractDiagrams($);
    // 모듈 및 클래스 정보 추출
    const modules = extractModules($);
    conceptualModel.modules = modules;
    // 결과 문서 생성
    const result = {
        title,
        version,
        url: CONCEPT_MODEL_URL,
        sections,
        diagrams,
        model: conceptualModel
    };
    // 캐시에 저장
    setMemoryCache(CONCEPT_MODEL_CACHE_KEY, result, CACHE_TTL.MEMORY);
    setDiskCache(CONCEPT_MODEL_CACHE_KEY, result, CACHE_TTL.DISK);
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
 * 문서에서 섹션 정보 추출
 */
function extractSections($) {
    const sections = [];
    // 상위 수준의 헤딩부터 순회
    $('h1, h2').each((i, el) => {
        const $el = $(el);
        const id = $el.attr('id') || `section-${i}`;
        const title = $el.text().trim();
        // 상위 수준 섹션 생성
        const section = {
            id,
            title,
            content: extractSectionContent($, $el),
            subsections: [],
            relatedClasses: findRelatedClasses($, $el),
            relatedDiagrams: findRelatedDiagrams($, $el)
        };
        // 하위 섹션 추출
        section.subsections = extractSubsections($, $el);
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
                    content: extractSectionContent($, $nextEl),
                    relatedClasses: findRelatedClasses($, $nextEl),
                    relatedDiagrams: findRelatedDiagrams($, $nextEl)
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
                    content: extractSectionContent($, $nextEl),
                    relatedClasses: findRelatedClasses($, $nextEl),
                    relatedDiagrams: findRelatedDiagrams($, $nextEl)
                };
                subsections.push(subsection);
            }
            $nextEl = $nextEl.next();
        }
    }
    return subsections;
}
/**
 * 섹션 내용 추출
 */
function extractSectionContent($, $heading) {
    const headingTagName = $heading.prop('tagName')?.toLowerCase() || '';
    let content = '';
    // 다음 헤딩을 만날 때까지 내용 수집
    let $nextEl = $heading.next();
    while ($nextEl.length) {
        const tagName = $nextEl.prop('tagName')?.toLowerCase();
        // 같은 레벨이나 상위 레벨 헤딩을 만나면 종료
        if (tagName && ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
            // 현재 헤딩 레벨보다 같거나 높은 레벨이면 종료
            const currentLevel = parseInt(headingTagName.substring(1));
            const nextLevel = parseInt(tagName.substring(1));
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
 * 관련 클래스 찾기
 */
function findRelatedClasses($, $heading) {
    const relatedClasses = [];
    const content = extractSectionContent($, $heading);
    // 클래스 이름 패턴 (예: Building, CityModel 등)
    const classPattern = /\b([A-Z][a-zA-Z0-9]*(?:Type|Class|Feature|Object)?)\b/g;
    let match;
    while ((match = classPattern.exec(content)) !== null) {
        const className = match[1];
        // 일반적인 단어 제외
        const commonWords = ['The', 'A', 'An', 'In', 'On', 'Figure', 'Table', 'Section'];
        if (!commonWords.includes(className) && !relatedClasses.includes(className)) {
            relatedClasses.push(className);
        }
    }
    return relatedClasses;
}
/**
 * 관련 다이어그램 찾기
 */
function findRelatedDiagrams($, $heading) {
    const relatedDiagrams = [];
    const content = extractSectionContent($, $heading);
    // 다이어그램 참조 패턴 (예: "Figure 1", "Fig. 2" 등)
    const diagramPattern = /\b(?:Figure|Fig\.)\s+(\d+)/g;
    let match;
    while ((match = diagramPattern.exec(content)) !== null) {
        const diagramId = `diagram-${match[1]}`;
        if (!relatedDiagrams.includes(diagramId)) {
            relatedDiagrams.push(diagramId);
        }
    }
    return relatedDiagrams;
}
/**
 * 다이어그램 추출
 */
function extractDiagrams($) {
    const diagrams = [];
    // 다이어그램(이미지가 있는 figure 요소) 찾기
    $('figure, .figure').each((i, el) => {
        const $figure = $(el);
        const $img = $figure.find('img');
        if ($img.length) {
            const id = $figure.attr('id') || `diagram-${i}`;
            const title = $figure.find('figcaption').text().trim() ||
                $figure.attr('title') ||
                $img.attr('alt') ||
                `Diagram ${i + 1}`;
            const imageUrl = $img.attr('src') || '';
            // 다이어그램에 포함된 UML 요소 추출
            const elements = extractUMLElements($, $figure);
            diagrams.push({
                id,
                title,
                url: imageUrl,
                elements
            });
        }
    });
    return diagrams;
}
/**
 * UML 요소 추출
 */
function extractUMLElements($, $figure) {
    const elements = [];
    const caption = $figure.find('figcaption').text();
    // 캡션에서 클래스 이름 추출
    const classPattern = /\b([A-Z][a-zA-Z0-9]*(?:Type|Class|Feature|Object)?)\b/g;
    let match;
    while ((match = classPattern.exec(caption)) !== null) {
        const className = match[1];
        // 일반적인 단어 제외
        const commonWords = ['The', 'A', 'An', 'In', 'On', 'Figure', 'Table', 'Section', 'UML'];
        if (!commonWords.includes(className)) {
            // 이미 추가된 요소가 있는지 확인
            const existingElement = elements.find(e => e.name === className);
            if (!existingElement) {
                elements.push({
                    id: `element-${elements.length}`,
                    type: 'class',
                    name: className
                });
            }
        }
    }
    return elements;
}
/**
 * 모듈 추출
 */
function extractModules($) {
    const modules = [];
    // 모듈 섹션 찾기
    // 모듈 관련 헤딩 찾기
    const moduleHeadings = $('h1, h2, h3').filter((i, el) => {
        const text = $(el).text().toLowerCase();
        return text.includes('module') ||
            text.includes('package') ||
            text.includes('modelling domain');
    });
    moduleHeadings.each((i, el) => {
        const $heading = $(el);
        const headingText = $heading.text().trim();
        // 모듈 이름 추출
        const moduleNameMatch = headingText.match(/(?:The\s+)?([a-zA-Z0-9]+)(?:\s+Module|\s+Package|\s+Component|\s+Model)/i);
        if (!moduleNameMatch)
            return;
        const moduleName = moduleNameMatch[1];
        // 이미 추가된 모듈인지 확인
        if (modules.find(m => m.name.toLowerCase() === moduleName.toLowerCase())) {
            return;
        }
        // 모듈 설명 추출
        const description = extractSectionContent($, $heading).substring(0, 500);
        // 모듈 객체 생성
        const module = {
            name: moduleName,
            namespace: `http://www.opengis.net/citygml/${moduleName.toLowerCase()}/3.0`,
            description,
            classes: extractClassesForModule($, $heading, moduleName)
        };
        modules.push(module);
    });
    // 코어 모듈이 없으면 추가
    if (!modules.find(m => m.name.toLowerCase() === 'core')) {
        modules.push({
            name: 'Core',
            namespace: 'http://www.opengis.net/citygml/3.0',
            description: 'CityGML Core Module',
            classes: []
        });
    }
    return modules;
}
/**
 * 특정 모듈의 클래스 추출
 */
function extractClassesForModule($, $moduleHeading, moduleName) {
    const classes = [];
    const moduleContent = extractSectionContent($, $moduleHeading);
    // 클래스 이름 패턴 (예: Building, CityModel 등)
    const classPattern = /\b([A-Z][a-zA-Z0-9]*(?:Type|Class|Feature|Object)?)\b/g;
    let match;
    const processedClasses = new Set();
    while ((match = classPattern.exec(moduleContent)) !== null) {
        const className = match[1];
        // 이미 처리한 클래스 또는 일반적인 단어 건너뛰기
        const commonWords = ['The', 'A', 'An', 'In', 'On', 'Figure', 'Table', 'Section', 'UML'];
        if (processedClasses.has(className) || commonWords.includes(className)) {
            continue;
        }
        processedClasses.add(className);
        // 클래스 정보 찾기
        const classInfo = findClassInfo($, className);
        if (classInfo) {
            classInfo.module = moduleName;
            classes.push(classInfo);
        }
        else {
            // 기본 클래스 정보
            classes.push({
                name: className,
                description: `Class in the ${moduleName} module`,
                module: moduleName,
                attributes: []
            });
        }
    }
    return classes;
}
/**
 * 클래스 정보 찾기
 */
function findClassInfo($, className) {
    // 클래스 관련 헤딩 찾기
    const classHeadings = $('h2, h3, h4, h5').filter((i, el) => {
        const text = $(el).text();
        return text.includes(className);
    });
    if (classHeadings.length === 0) {
        return null;
    }
    const $heading = classHeadings.first();
    const content = extractSectionContent($, $heading);
    // 클래스 설명 추출
    const description = content.substring(0, 300).replace(/<[^>]*>/g, '').trim();
    // 상위 클래스 찾기
    const superClassMatch = content.match(/(?:extends|inherits from|subclass of)\s+([A-Z][a-zA-Z0-9]*)/i);
    const superClasses = superClassMatch ? [superClassMatch[1]] : undefined;
    // 추상 클래스 여부
    const isAbstract = content.toLowerCase().includes('abstract class') || content.toLowerCase().includes('abstract type');
    // 속성 추출
    const attributes = extractAttributes($, content, className);
    // 관계 추출
    const associations = extractAssociations($, content, className);
    return {
        name: className,
        description,
        module: '', // 호출자가 설정
        stereotype: isAbstract ? 'abstract' : undefined,
        superClasses,
        isAbstract,
        attributes,
        associations
    };
}
/**
 * 클래스 속성 추출
 */
function extractAttributes($, content, className) {
    const attributes = [];
    // 테이블에서 속성 정보 찾기
    const $contentEl = $('<div>').html(content);
    const $tables = $contentEl.find('table');
    $tables.each((i, table) => {
        const $table = $(table);
        const $rows = $table.find('tr');
        // 헤더 확인
        const $headerRow = $rows.first();
        const headers = $headerRow.find('th').map((j, th) => $(th).text().trim().toLowerCase()).get();
        // 속성 관련 테이블인지 확인 (이름과 타입 컬럼 필요)
        const nameIndex = headers.findIndex((h) => h.includes('name') || h.includes('attribute'));
        const typeIndex = headers.findIndex((h) => h.includes('type'));
        const cardinalityIndex = headers.findIndex((h) => h.includes('cardinality') || h.includes('multiplicity'));
        if (nameIndex === -1 || typeIndex === -1) {
            return;
        }
        // 속성 정보 추출
        $rows.slice(1).each((j, row) => {
            const $cells = $(row).find('td');
            if ($cells.length <= Math.max(nameIndex, typeIndex)) {
                return;
            }
            const name = $cells.eq(nameIndex).text().trim();
            const type = $cells.eq(typeIndex).text().trim();
            // 유효한 속성 이름인지 확인
            if (!name || name.length < 2) {
                return;
            }
            const attribute = {
                name,
                type,
                cardinality: cardinalityIndex !== -1 ? $cells.eq(cardinalityIndex).text().trim() : '0..1'
            };
            attributes.push(attribute);
        });
    });
    return attributes;
}
/**
 * 클래스 관계 추출
 */
function extractAssociations($, content, className) {
    const associations = [];
    // 관계를 나타내는 패턴 찾기
    const relationPatterns = [
        // 관계를 설명하는 문장 패턴
        /([A-Z][a-zA-Z0-9]*)\s+(?:has|contains|references|relates to)\s+(?:a|an|the|one or more)?\s+([A-Z][a-zA-Z0-9]*)/gi,
        // UML 표기법 패턴 (예: Building ---> BuildingPart [0..*])
        /([A-Z][a-zA-Z0-9]*)\s*(?:--|→|-->|—>|->)\s*([A-Z][a-zA-Z0-9]*)\s*(?:\[\s*([0-9]+|[0-9]+\.\.[0-9]+|\*)\s*\])?/gi
    ];
    for (const pattern of relationPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const source = match[1];
            const target = match[2];
            const cardinality = match[3] || '0..*';
            // 현재 클래스와 관련된 관계만 추가
            if (source === className) {
                associations.push({
                    name: `${source}To${target}`,
                    target,
                    cardinality,
                    role: target.charAt(0).toLowerCase() + target.slice(1)
                });
            }
        }
    }
    return associations;
}
