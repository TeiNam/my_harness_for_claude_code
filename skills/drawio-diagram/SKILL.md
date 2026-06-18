---
name: drawio-diagram
description: draw.io(diagrams.net) 다이어그램을 격자 셀 좌표계 규칙으로 생성하고, MCP 툴(create→export→검증→edit) 루프로 좌우/상하 밸런스·화살표/텍스트 겹침을 잡아내는 스킬. 트리거 — "draw.io 그려줘", "다이어그램 만들어", "drawio 다이어그램", "아키텍처 다이어그램", "플로우차트/순서도 그려", "mxGraph XML", "다이어그램 정렬/겹침 고쳐".
origin: harness
version: 1.0.0
workloads: [core]
---

# draw.io Diagram Generator

LLM이 좌표를 즉흥 계산하면 좌우/상하 밸런스가 어긋나고 화살표·텍스트가 겹친다.
이 스킬은 그 문제를 두 축으로 잡는다:

1. **격자 셀 좌표계** — 위치를 `row/col × 상수` 공식으로만 산출해 "눈대중" 여지를 없앤다.
2. **MCP 검증 루프** — `create → export(PNG) → 좌표·이미지 이중 검증 → edit` 을 반복해 실제 결과로 수렴시킨다.

## When to Activate

- draw.io / diagrams.net 다이어그램 생성 요청
- 아키텍처도, 플로우차트, 시퀀스, 조직도, ER, 네트워크 다이어그램
- 기존 다이어그램의 정렬·겹침·밸런스 수정 요청
- mxGraphModel XML 직접 작성 요청

## 핵심 원칙 (왜 이 규칙인가)

> **계산을 없애고 규칙으로 좌표가 자동으로 떨어지게 만든다.**
> "균형 맞춰라" 같은 정성적 지시는 매번 어긋난다. 좌표를 산술 공식에 묶어야 정렬이 보장된다.

---

## 1. 격자 셀 좌표계 (가장 중요)

### 셀 상수

```
CELL_W = 240   # 셀 가로 간격
CELL_H = 160   # 셀 세로 간격
NODE_W = 200   # 도형 기본 가로 (특수 도형 제외)
NODE_H = 80    # 도형 기본 세로
MARGIN = 40    # 캔버스 좌상단 여백
```

### 좌표 공식 (이 공식 외 임의 좌표 금지)

```
x = MARGIN + col * CELL_W
y = MARGIN + row * CELL_H
```

- 모든 노드는 `(row, col)` 정수 좌표만 갖는다. 픽셀을 직접 쓰지 않는다.
- 같은 레벨(같은 row 또는 같은 col)의 노드는 반드시 동일 공식값을 공유한다 → 자동 정렬.

### 좌우 대칭 (밸런스)

한 레벨에 노드가 N개일 때, 전체 캔버스 열 수 `MAX_COLS` 기준 중앙 대칭 배치:

```
start_col = floor((MAX_COLS - N) / 2)
각 노드 col = start_col + i   (i = 0..N-1)
```

- `MAX_COLS` 는 전체 다이어그램에서 한 레벨의 최대 노드 수로 고정한다.
- 모든 레벨이 같은 `MAX_COLS` 기준으로 중앙 정렬되므로 좌우 밸런스가 산술적으로 맞는다.

### 흐름 방향

- 주 흐름은 **하나만** 정한다 (top→bottom 권장, 또는 left→right).
- 역방향 엣지는 예외로만 사용.

---

## 2. 연결점·라우팅 규칙 (화살표 겹침 방지)

### 고정 연결점 (방향별로 못 박는다)

**세로 흐름(top→bottom):**
```
출발 도형: exitX=0.5  exitY=1   (하단 중앙)
도착 도형: entryX=0.5 entryY=0   (상단 중앙)
```

**가로 흐름(left→right):**
```
출발 도형: exitX=1   exitY=0.5  (우측 중앙)
도착 도형: entryX=0  entryY=0.5  (좌측 중앙)
```

### 다중 분기 — 연결점 분산

한 도형에서 여러 갈래가 나갈 때 출구를 분산해 선이 겹치지 않게 한다:

```
2갈래: exitX = 0.33 / 0.67
3갈래: exitX = 0.25 / 0.5 / 0.75
```

도착 측 entryX도 동일하게 분산. 절대 두 엣지가 같은 경로를 공유하지 않게 한다.

### 엣지 스타일 (항상 적용)

```
edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=classic;
```

- 직교 라우팅, 90도 굴절만, 엣지당 최대 2굴절.
- 양방향(A<->B)은 서로 반대편 연결점 사용.

---

## 3. 라벨 공간 사전 확보 (겹침의 절반은 여기서)

겹침의 절반은 도형 간격이 라벨 자리를 고려 안 해서 생긴다.

```
- 엣지에 라벨이 있으면, 연결된 두 도형 사이 세로 간격을 1.5칸으로 넓힌다
  (row 차이를 1 → 1.5, 즉 해당 구간만 +80px).
- 엣지 라벨 스타일에 labelBackgroundColor=#FFFFFF 필수 (가독성).
- 라벨 폭이 NODE_W를 넘으면 두 줄로 줄바꿈.
- 아이콘+캡션은 하나의 바운딩 박스로 취급. 엣지는 캡션 영역을 ~20px 우회.
  하단을 연결에 쓰면 캡션은 빈 측면(좌/우)에 둔다.
```

---

## 4. 텍스트 컨테인먼트 (HARD CONSTRAINT)

```
- 모든 도형 스타일에 whiteSpace=wrap;html=1; 필수.
- 텍스트는 박스 안에 100% 포함. 사방 최소 8px 패딩 확보.
- 안 들어가면 박스를 키운다 — 절대 패딩 축소/텍스트 클리핑 금지.
  · 가로 초과: NODE_W를 240/280으로 키우고 해당 col 이후를 한 칸씩 민다.
  · 세로 초과: NODE_H를 100/120으로 키운다.
- 카테고리별 fontSize/색상/스타일 일관 유지.
```

---

## 5. 색상·구조 (의미 기반)

- 색은 상태/타입에 따라 의미 있게만 쓴다 (임의 금지).
- 색이 2개 이상 의미를 가지면 작은 **범례(legend)** 를 우하단에 배치.
- 관련 도형은 컨테이너/스윔레인으로 묶어 영역을 구분.
- 시각 위계: 제목 > 노드 > 주석 (size/weight로 구분).

---

## 6. 실행 워크플로 (MCP 루프)

```
1. start_session
      → 브라우저 실시간 프리뷰 오픈.

2. create_new_diagram(xml)
      → §1~5 규칙으로 좌표를 공식 산출한 XML 생성.
      [주의] 기존 다이어그램 수정 시에는 절대 create 금지 → get_diagram 후 edit_diagram.

3. export_diagram(path="./_drawio_check.png", format="png")

4. [좌표 검증] — 산술로 1차 필터
      모든 도형 쌍 (A,B)에 대해 사각형 겹침 점검:
        overlap = (A.x < B.x+B.w) && (A.x+A.w > B.x)
               && (A.y < B.y+B.h) && (A.y+A.h > B.y)
      겹치면 §1 공식으로 재배치.
      검증 표를 먼저 출력: | 노드 | x | y | 우측끝 | 하단끝 |

5. [이미지 검증] — PNG를 Read로 열어 육안 확인
      · 화살표가 도형을 관통하는가
      · 엣지끼리 경로가 겹치는가
      · 라벨이 도형/선과 겹치는가
      · 좌우/상하 밸런스가 맞는가 (한쪽 쏠림)
      · 텍스트가 박스를 벗어나는가

6. 문제 발견 시 get_diagram → edit_diagram(operations)으로 해당 셀만 수정 → 3번부터 반복.
      종료 조건: 좌표 검증 통과 AND 이미지 검증에서 결함 0.

7. 완료 후 _drawio_check.png 정리(불필요 시).
```

### 검증 체크리스트 (출력 전 필수)

1. 엣지가 도형을 관통하지 않음 — 모두 정의된 연결점에 anchored.
2. 엣지끼리 경로 공유/중복 없음, 교차 최소화.
3. 텍스트 컨테인먼트 — 모든 박스 텍스트가 8px 패딩 안에 100% 포함.
4. 라벨이 도형/선과 겹치지 않음 (배경 #FFFFFF).
5. 아이콘 캡션에 엣지/화살표가 닿지 않음.
6. 간격·정렬 균일, 모든 요소가 페이지 범위 내.
7. XML 유효, 모든 ID 유일 (id=0,1 예약, 최상위 parent=1).
8. AWS 아이콘이면 빈 사각형(색만 칠해짐) 없음 — §7 참고.

---

## 7. AWS 아키텍처 — 공식 아이콘 (mxgraph.aws4)

AWS 아키텍처 다이어그램은 일반 박스가 아니라 draw.io 내장 `mxgraph.aws4`
공식 아이콘을 쓴다. AWS 리소스가 아닌 것(NGINX, 앱 마이크로서비스)만 박스로 둔다.

### resourceIcon 스타일 틀

```
sketch=0;outlineConnect=0;fontColor=#232F3E;gradientColor=none;
fillColor={브랜드컬러};strokeColor=#ffffff;dashed=0;html=1;fontSize=12;aspect=fixed;
shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.{아이콘이름};
```

- 아이콘 크기는 78×78 (resourceIcon 표준).
- 카테고리별 fillColor: Networking `#8C4FFF`, Storage `#7AA116`, Security `#DD344C`,
  Containers `#ED7100`, Database `#C925D1`, Analytics/Streaming `#E7157B`.

### 빈 아이콘(empty box) 함정 — 반드시 검증

`resIcon=` 의 스텐실 이름이 설치된 aws4 라이브러리에 **없으면**, draw.io는
에러 없이 **색만 칠해진 빈 사각형**으로 렌더한다. 좌표 검증으로는 절대 못 잡고,
**이미지 검증(PNG)** 으로만 보인다.

> **이름을 기억으로 확신하지 마라.** 의심되면 후보 이름들을 한 다이어그램에
> 나열해 export → 어느 게 실제로 그려지는지 눈으로 확정한 뒤 본 다이어그램에 적용한다.

검증된 정답 이름 (풀네임이 아니라 짧은 약어가 맞는 경우가 많음):

| 리소스 | [O] 맞는 resIcon | [X] 빈 박스 되는 이름 |
|--------|----------------|---------------------|
| S3 | `s3` | `simple_storage_service` |
| EKS | `eks` | `elastic_kubernetes_service` |
| MSK | `managed_streaming_for_kafka` | `managed_streaming_for_apache_kafka` |
| ElastiCache | `elasticache` | — |
| Aurora | `aurora` | — |
| Route 53 | `route_53` | — |
| CloudFront | `cloudfront` | — |
| DynamoDB | `dynamodb` | — |
| WAF | `waf` | — |
| Users(군중) | `shape=mxgraph.aws4.users` (resIcon 아님) | — |

### 아이콘 캡션 vs 화살표 (§3 ICON LABELS 적용)

- 아이콘은 캡션이 별도 라벨이라 화살표와 겹치기 쉽다.
- 하향 화살표가 있는 스파인 아이콘 → 캡션을 측면에:
  `verticalLabelPosition=middle;verticalAlign=middle;labelPosition=right;align=left;spacingLeft=8;`
- 그 아이콘의 측면(예: 우측)으로 다른 엣지가 나가면, 캡션은 **반대 측면**으로:
  `labelPosition=left;align=right;spacingRight=8;`
- 하향 화살표가 없는 리프 아이콘(S3·DB류) → 캡션 아래(표준):
  `verticalLabelPosition=bottom;verticalAlign=top;align=center;`

---

## 미니 템플릿 (세로 흐름, 3노드 레벨)

```xml
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <!-- Level 0: 1노드, MAX_COLS=3 → start_col=floor((3-1)/2)=1 -->
    <mxCell id="n1" value="Client" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;"
            vertex="1" parent="1">
      <mxGeometry x="280" y="40" width="200" height="80" as="geometry"/>
    </mxCell>
    <!-- Level 1: 3노드 → start_col=0 → col 0,1,2 -->
    <mxCell id="n2" value="API Gateway" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;"
            vertex="1" parent="1">
      <mxGeometry x="40" y="200" width="200" height="80" as="geometry"/>
    </mxCell>
    <mxCell id="n3" value="Auth Service" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;"
            vertex="1" parent="1">
      <mxGeometry x="280" y="200" width="200" height="80" as="geometry"/>
    </mxCell>
    <mxCell id="n4" value="DB" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;"
            vertex="1" parent="1">
      <mxGeometry x="520" y="200" width="200" height="80" as="geometry"/>
    </mxCell>
    <!-- 분기: exitX 0.25/0.5/0.75 분산, entryY=0 상단 도착 -->
    <mxCell id="e1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=classic;exitX=0.25;exitY=1;entryX=0.5;entryY=0;"
            edge="1" parent="1" source="n1" target="n2">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>
    <mxCell id="e2" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=classic;exitX=0.5;exitY=1;entryX=0.5;entryY=0;"
            edge="1" parent="1" source="n1" target="n3">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>
    <mxCell id="e3" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=classic;exitX=0.75;exitY=1;entryX=0.5;entryY=0;"
            edge="1" parent="1" source="n1" target="n4">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>
```

## 안티패턴

- [X] 픽셀 좌표 즉흥 입력 (`x=137 y=283`) → 공식 위반, 밸런스 깨짐.
- [X] exit/entry 생략 → 엔진이 중앙 라우팅해 도형 관통.
- [X] 한 도형에서 나가는 다중 엣지의 exitX 동일 → 경로 겹침.
- [X] create_new_diagram 으로 기존 다이어그램 수정 → 전체 파괴. 반드시 edit_diagram.
- [X] 이미지 검증 생략하고 "겹침 없음" 단정 → 좌표만으로는 라벨 미세 겹침 못 잡음.
