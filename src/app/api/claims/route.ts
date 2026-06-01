import { NextRequest, NextResponse } from 'next/server';
import { CLAIMS } from '@/lib/rcm-data';
import { db } from '@/lib/db';
import type { ClaimRecord, ClaimStatus, PayerType } from '@/lib/rcm-types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filter parameters
    const status = searchParams.get('status') as ClaimStatus | null;
    const payerType = searchParams.get('payerType') as PayerType | null;
    const payerId = searchParams.get('payerId') as string | null;
    const minAmount = searchParams.get('minAmount') ? parseFloat(searchParams.get('minAmount')!) : undefined;
    const maxAmount = searchParams.get('maxAmount') ? parseFloat(searchParams.get('maxAmount')!) : undefined;
    const tag = searchParams.get('tag') as string | null;
    const search = searchParams.get('search')?.toLowerCase() ?? '';
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);

    // Try reading from the database first
    try {
      const dbClaims = await db.claim.findMany({ orderBy: { createdAt: 'desc' } });

      if (dbClaims.length > 0) {
        // Transform DB records to match ClaimRecord type (parse tags JSON)
        let filtered: ClaimRecord[] = dbClaims.map((c) => ({
          ...c,
          tags: JSON.parse(c.tags as string || '[]'),
          serviceDate: c.serviceDate.toISOString(),
          submittedAt: c.submittedAt?.toISOString() ?? undefined,
          expectedResponseBy: c.expectedResponseBy?.toISOString() ?? undefined,
          appealDeadline: c.appealDeadline?.toISOString() ?? undefined,
          filingDeadline: c.filingDeadline?.toISOString() ?? undefined,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
          priorAuthNumber: c.priorAuthNumber ?? undefined,
          priorAuthStatus: c.priorAuthStatus ?? undefined,
          currentAgent: c.currentAgent ?? undefined,
        }));

        // Apply filters
        if (status) {
          filtered = filtered.filter((c) => c.status === status);
        }
        if (payerType) {
          filtered = filtered.filter((c) => c.payerType === payerType);
        }
        if (payerId) {
          filtered = filtered.filter((c) => c.payerId === payerId);
        }
        if (minAmount !== undefined) {
          filtered = filtered.filter((c) => c.totalAmount >= minAmount);
        }
        if (maxAmount !== undefined) {
          filtered = filtered.filter((c) => c.totalAmount <= maxAmount);
        }
        if (tag) {
          filtered = filtered.filter((c) => c.tags.includes(tag));
        }
        if (search) {
          filtered = filtered.filter(
            (c) =>
              c.patientName.toLowerCase().includes(search) ||
              c.claimNumber.toLowerCase().includes(search) ||
              c.payerName.toLowerCase().includes(search)
          );
        }

        // Compute summary statistics
        const totalAmount = filtered.reduce((sum, c) => sum + c.totalAmount, 0);
        const paidAmount = filtered.reduce((sum, c) => sum + c.paidAmount, 0);
        const avgReadiness = filtered.length > 0
          ? Math.round(filtered.reduce((sum, c) => sum + c.readinessScore, 0) / filtered.length)
          : 0;
        const avgDenialRisk = filtered.length > 0
          ? Math.round(filtered.reduce((sum, c) => sum + c.denialRiskScore, 0) / filtered.length)
          : 0;

        const statusDistribution: Record<string, number> = {};
        for (const c of filtered) {
          statusDistribution[c.status] = (statusDistribution[c.status] || 0) + 1;
        }

        const start = (page - 1) * limit;
        const paginatedClaims = filtered.slice(start, start + limit);

        return NextResponse.json({
          claims: paginatedClaims,
          pagination: {
            page,
            limit,
            total: filtered.length,
            totalPages: Math.ceil(filtered.length / limit),
          },
          summary: {
            totalClaims: filtered.length,
            totalAmount: Math.round(totalAmount * 100) / 100,
            totalPaid: Math.round(paidAmount * 100) / 100,
            avgReadinessScore: avgReadiness,
            avgDenialRiskScore: avgDenialRisk,
            statusDistribution,
          },
        });
      }
    } catch (e) {
      // Fall through to mock data
      console.error('DB read failed, falling back to mock data:', e);
    }

    // Fallback: use mock data
    let filtered: ClaimRecord[] = [...CLAIMS];

    // Apply filters
    if (status) {
      filtered = filtered.filter((c) => c.status === status);
    }
    if (payerType) {
      filtered = filtered.filter((c) => c.payerType === payerType);
    }
    if (payerId) {
      filtered = filtered.filter((c) => c.payerId === payerId);
    }
    if (minAmount !== undefined) {
      filtered = filtered.filter((c) => c.totalAmount >= minAmount);
    }
    if (maxAmount !== undefined) {
      filtered = filtered.filter((c) => c.totalAmount <= maxAmount);
    }
    if (tag) {
      filtered = filtered.filter((c) => c.tags.includes(tag));
    }
    if (search) {
      filtered = filtered.filter(
        (c) =>
          c.patientName.toLowerCase().includes(search) ||
          c.claimNumber.toLowerCase().includes(search) ||
          c.payerName.toLowerCase().includes(search)
      );
    }

    // Compute summary statistics
    const totalAmount = filtered.reduce((sum, c) => sum + c.totalAmount, 0);
    const paidAmount = filtered.reduce((sum, c) => sum + c.paidAmount, 0);
    const avgReadiness = filtered.length > 0
      ? Math.round(filtered.reduce((sum, c) => sum + c.readinessScore, 0) / filtered.length)
      : 0;
    const avgDenialRisk = filtered.length > 0
      ? Math.round(filtered.reduce((sum, c) => sum + c.denialRiskScore, 0) / filtered.length)
      : 0;

    // Status distribution
    const statusDistribution: Record<string, number> = {};
    for (const c of filtered) {
      statusDistribution[c.status] = (statusDistribution[c.status] || 0) + 1;
    }

    // Pagination
    const start = (page - 1) * limit;
    const paginatedClaims = filtered.slice(start, start + limit);

    return NextResponse.json({
      claims: paginatedClaims,
      pagination: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limit),
      },
      summary: {
        totalClaims: filtered.length,
        totalAmount: Math.round(totalAmount * 100) / 100,
        totalPaid: Math.round(paidAmount * 100) / 100,
        avgReadinessScore: avgReadiness,
        avgDenialRiskScore: avgDenialRisk,
        statusDistribution,
      },
    });
  } catch (error) {
    console.error('Claims API error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve claims data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const claim = await db.claim.create({
      data: {
        ...body,
        tags: JSON.stringify(body.tags || []),
        serviceDate: new Date(body.serviceDate),
        filingDeadline: body.filingDeadline ? new Date(body.filingDeadline) : null,
        appealDeadline: body.appealDeadline ? new Date(body.appealDeadline) : null,
        submittedAt: body.submittedAt ? new Date(body.submittedAt) : null,
        expectedResponseBy: body.expectedResponseBy ? new Date(body.expectedResponseBy) : null,
      },
    });
    return NextResponse.json(claim, { status: 201 });
  } catch (error) {
    console.error('Create claim error:', error);
    return NextResponse.json({ error: 'Failed to create claim' }, { status: 500 });
  }
}
