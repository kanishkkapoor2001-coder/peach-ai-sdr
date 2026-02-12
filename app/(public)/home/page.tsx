"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  Check,
  Mail,
  Phone,
  MessageCircle,
  Zap,
  Users,
  BarChart3,
  Bot,
  Calendar,
  Shield,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";

const FEATURES = [
  {
    icon: Users,
    title: "Smart Lead Sourcing",
    description:
      "AI-powered lead discovery from multiple sources. Import CSVs or let our AI find your ideal prospects.",
  },
  {
    icon: Mail,
    title: "Personalized Outreach",
    description:
      "Generate highly personalized email sequences that resonate with each prospect's unique situation.",
  },
  {
    icon: Bot,
    title: "AI Sales Agent",
    description:
      "Full autonomous agent that handles research, outreach, and follow-ups with human approval.",
  },
  {
    icon: BarChart3,
    title: "Smart Analytics",
    description:
      "Real-time insights into campaign performance, reply rates, and prospect engagement.",
  },
  {
    icon: Calendar,
    title: "Meeting Intelligence",
    description:
      "Automatically capture meeting insights, action items, and update your CRM.",
  },
  {
    icon: Shield,
    title: "Deliverability First",
    description:
      "Built-in domain warmup, rotation, and monitoring to keep your emails out of spam.",
  },
];

const PRICING_TIERS = [
  {
    name: "Starter",
    price: "$49",
    period: "/month",
    description: "Perfect for individuals starting with AI-powered outreach",
    features: [
      "Up to 500 leads",
      "1,000 emails/month",
      "1 email domain",
      "Basic AI email generation",
      "Email tracking & analytics",
      "CSV import",
      "Email support",
    ],
    cta: "Start Free Trial",
    popular: false,
  },
  {
    name: "Professional",
    price: "$149",
    period: "/month",
    description: "For growing teams that need more power and features",
    features: [
      "Up to 5,000 leads",
      "10,000 emails/month",
      "3 email domains",
      "Advanced AI personalization",
      "AI Sales Agent access",
      "CRM integration",
      "Meeting intelligence",
      "Priority support",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large teams with custom requirements",
    features: [
      "Unlimited leads",
      "Unlimited emails",
      "Unlimited domains",
      "Custom AI training",
      "Dedicated account manager",
      "Custom integrations",
      "SLA guarantee",
      "White-label options",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

const FAQ = [
  {
    question: "How does the AI generate personalized emails?",
    answer:
      "Our AI analyzes each prospect's role, company, industry, and available data points to craft emails that feel personal and relevant. It uses proven sales frameworks and can adapt to your brand voice.",
  },
  {
    question: "Will my emails end up in spam?",
    answer:
      "We've built extensive deliverability features including domain warmup, smart rotation, and monitoring. Most customers see 90%+ inbox placement rates.",
  },
  {
    question: "Can I integrate with my existing CRM?",
    answer:
      "Yes! We offer native integrations with Notion, HubSpot, Salesforce, and Pipedrive. We also have a REST API for custom integrations.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "Absolutely! All plans come with a 14-day free trial. No credit card required to start.",
  },
];

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl text-gray-900">AI SDR</span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <a
                href="#features"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Features
              </a>
              <a
                href="#pricing"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Pricing
              </a>
              <a
                href="#faq"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                FAQ
              </a>
              <a
                href="#contact"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Contact
              </a>
            </div>

            {/* Auth Buttons */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-indigo-600 rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all"
              >
                Start Free Trial
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-gray-600" />
              ) : (
                <Menu className="w-5 h-5 text-gray-600" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-4">
            <a
              href="#features"
              className="block text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="block text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Pricing
            </a>
            <a
              href="#faq"
              className="block text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              FAQ
            </a>
            <a
              href="#contact"
              className="block text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Contact
            </a>
            <div className="pt-4 border-t border-gray-100 flex flex-col gap-2">
              <Link
                href="/login"
                className="w-full px-4 py-2 text-sm font-medium text-center text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="w-full px-4 py-2 text-sm font-medium text-center text-white bg-gradient-to-r from-violet-500 to-indigo-600 rounded-xl"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-50 text-violet-700 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              AI-Powered Sales Development
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight mb-6">
              Turn prospects into
              <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                {" "}
                customers
              </span>
              <br />
              with AI
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Automate your entire sales development workflow. From finding leads
              to booking meetings, our AI handles the heavy lifting while you
              close deals.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-violet-500 to-indigo-600 rounded-xl hover:shadow-xl hover:shadow-violet-500/25 transition-all flex items-center justify-center gap-2"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="#demo"
                className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
              >
                Watch Demo
              </Link>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              No credit card required. 14-day free trial.
            </p>
          </div>

          {/* Hero Image/Preview */}
          <div className="mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10 pointer-events-none" />
            <div className="bg-gradient-to-br from-violet-500/5 to-indigo-500/5 rounded-3xl border border-gray-200 p-4 shadow-2xl shadow-violet-500/10">
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {/* Mock Dashboard Preview */}
                <div className="h-[400px] sm:h-[500px] bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-violet-500/25">
                      <Sparkles className="w-10 h-10 text-white" />
                    </div>
                    <p className="text-gray-500 font-medium">
                      AI SDR Dashboard Preview
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      Your command center for AI-powered sales
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Everything you need to scale outreach
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              From lead sourcing to meeting booking, our AI handles the entire
              sales development workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((feature, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-white border border-gray-200 hover:border-violet-300 hover:shadow-lg transition-all duration-200"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-violet-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Start free, upgrade when you're ready. No hidden fees.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {PRICING_TIERS.map((tier, i) => (
              <div
                key={i}
                className={`relative p-8 rounded-2xl border-2 ${
                  tier.popular
                    ? "border-violet-500 shadow-xl shadow-violet-500/10"
                    : "border-gray-200"
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-sm font-medium rounded-full">
                    Most Popular
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {tier.name}
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-gray-900">
                      {tier.price}
                    </span>
                    <span className="text-gray-500">{tier.period}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{tier.description}</p>
                </div>

                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className={`w-full py-3 rounded-xl font-semibold transition-all ${
                    tier.popular
                      ? "bg-gradient-to-r from-violet-500 to-indigo-600 text-white hover:shadow-lg hover:shadow-violet-500/25"
                      : "border-2 border-gray-200 text-gray-700 hover:border-violet-300 hover:bg-violet-50"
                  }`}
                >
                  {tier.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Frequently asked questions
            </h2>
            <p className="text-lg text-gray-600">
              Everything you need to know about AI SDR.
            </p>
          </div>

          <div className="space-y-4">
            {FAQ.map((item, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-gray-900">
                    {item.question}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-500 transition-transform ${
                      openFaq === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4">
                    <p className="text-gray-600">{item.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-br from-violet-500 to-indigo-600 rounded-3xl p-8 sm:p-12 lg:p-16 text-white">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Ready to transform your sales?
              </h2>
              <p className="text-lg text-white/80 mb-8">
                Get in touch with our team to learn how AI SDR can help you close
                more deals.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                <a
                  href="mailto:kanishk@peach.study"
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <Mail className="w-6 h-6" />
                  <span className="font-medium">kanishk@peach.study</span>
                </a>
                <a
                  href="tel:+919711017316"
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <Phone className="w-6 h-6" />
                  <span className="font-medium">+91 97110 17316</span>
                </a>
                <a
                  href="https://wa.me/919711017316"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <MessageCircle className="w-6 h-6" />
                  <span className="font-medium">WhatsApp</span>
                </a>
              </div>

              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-violet-600 font-semibold rounded-xl hover:shadow-xl transition-all"
              >
                Start Your Free Trial
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-gray-200">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-gray-900">AI SDR</span>
            </div>

            <div className="flex items-center gap-8 text-sm text-gray-600">
              <a href="#" className="hover:text-gray-900 transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="hover:text-gray-900 transition-colors">
                Terms of Service
              </a>
              <a href="#" className="hover:text-gray-900 transition-colors">
                Documentation
              </a>
            </div>

            <p className="text-sm text-gray-500">
              © 2024 AI SDR. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
