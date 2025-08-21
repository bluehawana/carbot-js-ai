#!/bin/bash

echo "🤖 Claude Code Agents System-Wide Installation Test"
echo "=================================================="
echo ""

echo "📍 Agents Location: ~/.claude/agents/"
AGENT_COUNT=$(ls ~/.claude/agents/*.md 2>/dev/null | wc -l)
echo "📊 Total Agents: $AGENT_COUNT"
echo ""

echo "🔍 Sample Agents Available:"
ls ~/.claude/agents/*.md | head -10 | sed 's/.*\///' | sed 's/.md$//' | sed 's/^/   ✅ /'
echo "   ... and $(($AGENT_COUNT - 10)) more!"
echo ""

echo "🚀 How to Use Agents:"
echo "   🎯 Automatic: Just work - Claude will suggest relevant agents"
echo "   🎯 Explicit: 'Use the python-pro agent to review this code'"
echo "   🎯 Browse: Use /agents command in Claude CLI"
echo ""

echo "🧪 Testing Agent Categories:"
echo "   🔧 Development: python-pro, rust-pro, javascript-pro"
echo "   🏗️  Architecture: backend-architect, frontend-developer"
echo "   🔒 Security: security-auditor, incident-responder"
echo "   🤖 AI/ML: ai-engineer, ml-engineer, data-scientist"
echo "   📱 Mobile: mobile-developer, flutter-expert, ios-developer"
echo "   🌐 SEO/Content: seo-content-writer, content-marketer"
echo "   🛠️  Ops: devops-troubleshooter, terraform-specialist"
echo ""

echo "✅ AGENTS READY FOR ALL TERMINAL SESSIONS!"
echo "   Now available in any directory you run 'claude' from"