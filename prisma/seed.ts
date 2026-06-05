import { PrismaClient } from '@prisma/client';
import { AGENTS, CLAIMS, ESCALATIONS, KPIS, AUDIT_ENTRIES } from '../src/lib/rcm-data';
import { hashPassword } from '../src/lib/server/passwords';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // Clear all tables in reverse dependency order
  console.log('🧹 Clearing existing data...');
  await prisma.escalation.deleteMany({});
  console.log('  ✓ Escalations cleared');
  await prisma.kPIRecord.deleteMany({});
  console.log('  ✓ KPI Records cleared');
  await prisma.claim.deleteMany({});
  console.log('  ✓ Claims cleared');
  await prisma.agentStatus.deleteMany({});
  console.log('  ✓ Agent Statuses cleared');
  await prisma.auditLog.deleteMany({});
  console.log('  ✓ Audit logs cleared');
  await prisma.claimEvent.deleteMany({});
  await prisma.webhookDelivery.deleteMany({});
  await prisma.webhook.deleteMany({});
  await prisma.apiKey.deleteMany({});
  await prisma.idempotencyKey.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.setting.deleteMany({});
  console.log('  ✓ Processing events, webhooks, API keys, idempotency, users & settings cleared');

  // Seed Agents
  console.log('\n📋 Seeding agents...');
  for (const agent of AGENTS) {
    await prisma.agentStatus.create({
      data: {
        id: agent.id,
        agentName: agent.agentName,
        displayName: agent.displayName,
        description: agent.description,
        icon: agent.icon,
        status: agent.status,
        lastActivity: agent.lastActivity ? new Date(agent.lastActivity) : null,
        claimsProcessed: agent.claimsProcessed,
        activeClaims: agent.activeClaims,
        errorCount: agent.errorCount,
        avgProcessingMs: agent.avgProcessingMs,
        category: agent.category,
        sequence: agent.sequence,
      },
    });
  }
  console.log(`  ✓ ${AGENTS.length} agents seeded`);

  // Seed Claims
  console.log('\n💰 Seeding claims...');
  for (const claim of CLAIMS) {
    await prisma.claim.create({
      data: {
        id: claim.id,
        claimNumber: claim.claimNumber,
        patientId: claim.patientId,
        patientName: claim.patientName,
        nationalId: claim.nationalId,
        encounterId: claim.encounterId,
        payerId: claim.payerId,
        payerName: claim.payerName,
        payerType: claim.payerType,
        serviceDate: new Date(claim.serviceDate),
        totalAmount: claim.totalAmount,
        status: claim.status,
        readinessScore: claim.readinessScore,
        denialRiskScore: claim.denialRiskScore,
        priorAuthRequired: claim.priorAuthRequired,
        priorAuthNumber: claim.priorAuthNumber ?? null,
        priorAuthStatus: claim.priorAuthStatus ?? null,
        submittedAt: claim.submittedAt ? new Date(claim.submittedAt) : null,
        expectedResponseBy: claim.expectedResponseBy ? new Date(claim.expectedResponseBy) : null,
        paidAmount: claim.paidAmount,
        patientResponsibility: claim.patientResponsibility,
        appealDeadline: claim.appealDeadline ? new Date(claim.appealDeadline) : null,
        filingDeadline: claim.filingDeadline ? new Date(claim.filingDeadline) : null,
        phase: claim.phase,
        hitlGate: claim.hitlGate,
        currentAgent: claim.currentAgent ?? null,
        tags: JSON.stringify(claim.tags),
      },
    });
  }
  console.log(`  ✓ ${CLAIMS.length} claims seeded`);

  // Seed Escalations
  console.log('\n🚨 Seeding escalations...');
  for (const esc of ESCALATIONS) {
    await prisma.escalation.create({
      data: {
        id: esc.id,
        claimId: esc.claimId,
        claimNumber: esc.claimNumber,
        level: esc.level,
        reason: esc.reason,
        agentName: esc.agentName,
        status: esc.status,
        tags: JSON.stringify(esc.tags),
        assignedTo: esc.assignedTo ?? null,
        resolvedAt: esc.resolvedAt ? new Date(esc.resolvedAt) : null,
      },
    });
  }
  console.log(`  ✓ ${ESCALATIONS.length} escalations seeded`);

  // Seed RBAC demo users (inert until RCM_AUTH_ENABLED=true / RCM_UI_PASSWORD set).
  console.log('\n👤 Seeding demo users (RBAC)...');
  const demoUsers = [
    { email: 'admin@veebase.health', name: 'Platform Admin', role: 'ADMIN', password: process.env.RCM_SEED_ADMIN_PASSWORD || 'Admin!234' },
    { email: 'manager@veebase.health', name: 'RCM Manager', role: 'RCM_MANAGER', password: 'Manager!234' },
    { email: 'biller@veebase.health', name: 'Billing Specialist', role: 'BILLER', password: 'Biller!234' },
    { email: 'compliance@veebase.health', name: 'Compliance Officer', role: 'COMPLIANCE', password: 'Comply!234' },
    { email: 'viewer@veebase.health', name: 'Read-Only Viewer', role: 'VIEWER', password: 'Viewer!234' },
  ];
  for (const u of demoUsers) {
    await prisma.user.create({
      data: { email: u.email, name: u.name, role: u.role, passwordHash: hashPassword(u.password) },
    });
  }
  console.log(`  ✓ ${demoUsers.length} demo users seeded (admin@veebase.health / Admin!234)`);

  // Seed KPIs
  console.log('\n📊 Seeding KPI records...');
  for (const kpi of KPIS) {
    await prisma.kPIRecord.create({
      data: {
        id: kpi.id,
        name: kpi.name,
        value: kpi.value,
        target: kpi.target,
        unit: kpi.unit,
        category: kpi.category,
        period: kpi.period,
        trend: kpi.trend,
      },
    });
  }
  console.log(`  ✓ ${KPIS.length} KPI records seeded`);

  // Seed audit trail
  console.log('\n📜 Seeding audit trail...');
  for (const a of AUDIT_ENTRIES) {
    await prisma.auditLog.create({
      data: {
        id: a.id,
        timestamp: new Date(a.timestamp),
        action: a.action,
        actor: a.actor,
        actorRole: a.actorRole,
        claimNumber: a.claimNumber ?? null,
        agentName: a.agentName ?? null,
        details: a.details,
        previousValue: a.previousValue ?? null,
        newValue: a.newValue ?? null,
        riskLevel: a.riskLevel,
        tags: JSON.stringify(a.tags ?? []),
        source: 'ui',
      },
    });
  }
  console.log(`  ✓ ${AUDIT_ENTRIES.length} audit entries seeded`);

  console.log('\n✅ Database seeding complete!\n');

  // Print summary
  const agentCount = await prisma.agentStatus.count();
  const claimCount = await prisma.claim.count();
  const escalationCount = await prisma.escalation.count();
  const kpiCount = await prisma.kPIRecord.count();

  console.log('📈 Summary:');
  console.log(`  Agents:      ${agentCount}`);
  console.log(`  Claims:      ${claimCount}`);
  console.log(`  Escalations: ${escalationCount}`);
  console.log(`  KPIs:        ${kpiCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
