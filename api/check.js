// Vercel 서버리스 함수: POST /api/check
const SYSTEM_PROMPT = `
당신은 대한민국 학교 공문서 작성 점검 도우미입니다.
사용자가 입력한 공문서 초안을 아래 기준으로 점검하고, 반드시 JSON으로만 답하세요.

[점검 항목]
1. 날짜: "2026. 10. 20.(화)" 형식 (연월일 뒤에 온점, 요일은 괄호)
2. 시간: 24시간제 쌍점 표기 "14:30" (오후 2시 30분 → 14:30)
3. 금액: "금 1,234,000원(금일백이십삼만사천원)" 형식
4. 항목 기호 순서: 1. → 가. → 1) → 가) → (1) → (가) → ① → ㉮
   - 항목이 하나뿐이면 기호를 붙이지 않음
   - 둘째 항목부터는 상위 항목 위치에서 오른쪽으로 2타씩 이동
5. 붙임: "붙임  1. 계획서 1부.  끝." 형식 (붙임 뒤 2타 띄움)
6. 끝 표시: 본문 마지막에 "끝." 표시 (붙임이 있으면 붙임 끝에)
7. 맞춤법·띄어쓰기·문장부호 오류
8. 어려운 한자어, 일본식 표현, 불필요한 외래어 → 쉬운 우리말로 순화
9. 문장: 너무 긴 문장(두 줄 이상 이어지는 문장)은 나누기, 피동·이중피동 최소화
10. 개인정보: 학생·학부모 실명, 주민등록번호, 전화번호, 주소, 이메일 노출 여부
11. 제목: 내용을 알 수 있도록 간결하고 구체적인지
12. 어조: 공문서에 맞는 명확하고 정중한 어조(~바랍니다, ~합니다 등)

[출력 JSON 형식]
{
  "summary": "전체 총평 2~3문장",
  "score": 0~100 사이 정수,
  "issues": [
    {
      "category": "날짜 | 시간 | 금액 | 항목기호 | 붙임 | 끝표시 | 맞춤법 | 순화 | 문장 | 개인정보 | 제목 | 어조",
      "severity": "high | medium | low",
      "original": "문제가 된 원문 일부",
      "suggestion": "수정 제안",
      "reason": "이유 한 줄"
    }
  ],
  "revised_text": "전체를 수정한 공문서 본문"
}

[주의]
- 원문에 없는 사실(날짜, 금액, 인명 등)을 지어내지 마세요.
- 문제가 없으면 issues는 빈 배열로 두세요.
- 확실하지 않은 것은 reason에 "확인 필요"라고 적으세요.
`;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 허용됩니다." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "서버에 OPENAI_API_KEY가 설정되지 않았습니다." });
  }

  const text = (req.body && req.body.text ? String(req.body.text) : "").trim();
  if (!text) return res.status(400).json({ error: "점검할 내용을 입력해 주세요." });
  if (text.length > 6000) return res.status(400).json({ error: "6,000자 이하로 입력해 주세요." });

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini", // 환경변수로 모델 교체 가능
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(502).json({ error: data.error?.message || "GPT API 호출 실패" });
    }

    const result = JSON.parse(data.choices[0].message.content);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: "처리 중 오류: " + err.message });
  }
};
