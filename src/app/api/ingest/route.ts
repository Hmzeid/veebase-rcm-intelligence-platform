import { NextRequest, NextResponse } from 'next/server';

// POST - Upload and process a PDF claim
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const template = (formData.get('template') as string) || 'auto';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 });
    }

    // Convert PDF to base64 for VLM processing
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const pdfDataUrl = `data:application/pdf;base64,${base64}`;

    // Try VLM extraction
    try {
      // The z-ai SDK's vision body type is incomplete; cast the client to call createVision.
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = (await ZAI.create()) as unknown as { chat: { completions: { createVision: (b: unknown) => Promise<{ choices?: { message?: { content?: string } }[] }> } } };

      const templateInfo =
        template !== 'auto' ? `The document is from the "${template}" hospital system. ` : '';

      const response = await zai.chat.completions.createVision({
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are a medical claims data extraction specialist working for the Egyptian National Health Insurance system. ${templateInfo}
                
Extract all claim data from this document and return it as a JSON object with these fields:
{
  "patientName": "string - patient full name",
  "nationalId": "string - 14-digit Egyptian national ID",
  "payerName": "string - insurance payer name (NHIA, MedRight, Globemed, Nextcare, or Self-Pay)",
  "payerType": "string - NHIA, PRIVATE, or SELF_PAY",
  "payerId": "string - payer identifier",
  "serviceDate": "string - YYYY-MM-DD format",
  "totalAmount": "number - amount in EGP",
  "department": "string - hospital department",
  "procedureCodes": ["string - CPT codes"],
  "diagnosisCodes": ["string - ICD-10 codes"],
  "priorAuthRequired": "boolean",
  "priorAuthNumber": "string or null",
  "attendingPhysician": "string",
  "facilityName": "string",
  "encounterType": "string - Inpatient, Outpatient, or Emergency",
  "admissionDate": "string - YYYY-MM-DD or null",
  "dischargeDate": "string - YYYY-MM-DD or null",
  "notes": "string - any additional notes",
  "claimNumber": "string - original claim number if present",
  "fieldConfidence": { "fieldName": number 0-100 }
}

Rules:
- If a field cannot be found, use null
- National ID must be exactly 14 digits if found
- Amounts are in Egyptian Pounds (EGP)
- Rate your confidence (0-100) for each extracted field
- Look for both Arabic and English labels
- Common Arabic terms: مريض (patient), تاريخ (date), مبلغ (amount), رقم قومي (national ID)
- Return ONLY the JSON object, no additional text`,
              },
              {
                type: 'file_url',
                file_url: { url: pdfDataUrl },
              },
            ],
          },
        ],
        thinking: { type: 'disabled' },
      });

      const content = response.choices?.[0]?.message?.content;
      if (content) {
        // Try to parse the JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const extractedData = JSON.parse(jsonMatch[0]);
          const avgConfidence = extractedData.fieldConfidence
            ? (Object.values(extractedData.fieldConfidence) as number[]).reduce((a, b) => a + b, 0) /
              (Object.values(extractedData.fieldConfidence) as number[]).length
            : 50;

          return NextResponse.json({
            success: true,
            extractedData,
            confidence: Math.round(avgConfidence),
            method: 'vlm',
          });
        }
      }

      throw new Error('VLM returned unparseable response');
    } catch (vlmError) {
      console.warn(
        'VLM extraction failed, using fallback:',
        vlmError instanceof Error ? vlmError.message : 'Unknown'
      );

      // Fallback: generate simulated extraction based on template
      const fallbackData = generateFallbackExtraction(template, file.name);

      return NextResponse.json({
        success: true,
        extractedData: fallbackData,
        confidence: 65,
        method: 'fallback',
        note: 'AI extraction unavailable — using template-based fallback. Manual review recommended.',
      });
    }
  } catch (error) {
    console.error('Ingestion API error:', error);
    return NextResponse.json({ error: 'Failed to process PDF' }, { status: 500 });
  }
}

function generateFallbackExtraction(template: string, _fileName: string) {
  // Template-based fallback extraction
  const templates: Record<string, Record<string, unknown>> = {
    'cairo-med': {
      patientName: '[Auto-extracted from Cairo Medical Center format]',
      nationalId: '[14-digit ID]',
      payerName: 'NHIA',
      payerType: 'NHIA',
      payerId: 'NHIA',
      totalAmount: 0,
      department: '[Department]',
      priorAuthRequired: true,
      facilityName: 'Cairo Medical Center',
      fieldConfidence: { patientName: 30, nationalId: 20, totalAmount: 10 },
    },
    'nhia-standard': {
      patientName: '[Auto-extracted from NHIA format]',
      nationalId: '[14-digit ID]',
      payerName: 'NHIA',
      payerType: 'NHIA',
      payerId: 'NHIA',
      totalAmount: 0,
      priorAuthRequired: true,
      facilityName: '[Facility]',
      fieldConfidence: { patientName: 25, nationalId: 20, totalAmount: 10 },
    },
    default: {
      patientName: '[Manual entry required]',
      nationalId: '[Manual entry required]',
      payerName: 'Unknown',
      payerType: 'SELF_PAY',
      payerId: 'SELF_PAY',
      totalAmount: 0,
      fieldConfidence: { patientName: 5, nationalId: 5, totalAmount: 5 },
    },
  };

  return templates[template] || templates.default;
}
